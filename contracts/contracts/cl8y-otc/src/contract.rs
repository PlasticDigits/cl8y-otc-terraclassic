//! CL8Y OTC swap contract — minimal USDC-for-CL8Y at owner-set rate.

#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult, Uint128, Uint256, WasmMsg,
};
use cw2::set_contract_version;
use cw20::{Cw20ExecuteMsg, Cw20QueryMsg};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, InstantiateMsg, QueryMsg, SimulateSwapResponse,
};
use crate::state::{
    Config, CONFIG, CL8Y_UNIT, CONTRACT_NAME, CONTRACT_VERSION, DEFAULT_PRICE, TOTAL_USDC_SPENT,
};

// ============ INSTANTIATE ============

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let price = msg.price.unwrap_or_else(|| Uint128::from(DEFAULT_PRICE));
    if price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }

    let config = Config {
        owner: deps.api.addr_validate(&msg.owner)?,
        cl8y_token: deps.api.addr_validate(&msg.cl8y_token)?,
        usdc_denom: msg.usdc_denom,
        destination: deps.api.addr_validate(&msg.destination)?,
        price,
    };

    CONFIG.save(deps.storage, &config)?;
    TOTAL_USDC_SPENT.save(deps.storage, &Uint128::zero())?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("owner", config.owner)
        .add_attribute("price", price))
}

// ============ EXECUTE ============

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Swap {} => execute_swap(deps, env, info),
        ExecuteMsg::UpdateRate { price } => execute_update_rate(deps, info, price),
        ExecuteMsg::UpdateDestination { destination } => {
            execute_update_destination(deps, info, destination)
        }
        ExecuteMsg::WithdrawCl8y { amount } => execute_withdraw_cl8y(deps, info, amount),
    }
}

fn execute_swap(deps: DepsMut, env: Env, info: MessageInfo) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let usdc_in = parse_usdc_funds(&info.funds, &config.usdc_denom)?;
    let cl8y_out = compute_cl8y_out(usdc_in, config.price)?;

    let balance: cw20::BalanceResponse = deps.querier.query_wasm_smart(
        config.cl8y_token.clone(),
        &Cw20QueryMsg::Balance {
            address: env.contract.address.to_string(),
        },
    )?;

    if balance.balance < cl8y_out {
        return Err(ContractError::InsufficientCl8y {});
    }

    let transfer_cl8y = WasmMsg::Execute {
        contract_addr: config.cl8y_token.to_string(),
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
            recipient: info.sender.to_string(),
            amount: cl8y_out,
        })?,
        funds: vec![],
    };

    let forward_usdc = BankMsg::Send {
        to_address: config.destination.to_string(),
        amount: vec![Coin {
            denom: config.usdc_denom.clone(),
            amount: usdc_in,
        }],
    };

    let total = TOTAL_USDC_SPENT.load(deps.storage)?;
    TOTAL_USDC_SPENT.save(deps.storage, &(total + usdc_in))?;

    Ok(Response::new()
        .add_message(transfer_cl8y)
        .add_message(forward_usdc)
        .add_attribute("action", "swap")
        .add_attribute("sender", info.sender)
        .add_attribute("usdc_in", usdc_in)
        .add_attribute("cl8y_out", cl8y_out))
}

fn execute_update_rate(
    deps: DepsMut,
    info: MessageInfo,
    price: Uint128,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    assert_owner(&info, &config.owner)?;
    if price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }
    config.price = price;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("action", "update_rate")
        .add_attribute("price", price))
}

fn execute_update_destination(
    deps: DepsMut,
    info: MessageInfo,
    destination: String,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    assert_owner(&info, &config.owner)?;
    config.destination = deps.api.addr_validate(&destination)?;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("action", "update_destination")
        .add_attribute("destination", config.destination))
}

fn execute_withdraw_cl8y(
    deps: DepsMut,
    info: MessageInfo,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    assert_owner(&info, &config.owner)?;

    let transfer = WasmMsg::Execute {
        contract_addr: config.cl8y_token.to_string(),
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
            recipient: config.owner.to_string(),
            amount,
        })?,
        funds: vec![],
    };

    Ok(Response::new()
        .add_message(transfer)
        .add_attribute("action", "withdraw_cl8y")
        .add_attribute("amount", amount))
}

// ============ QUERY ============

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::TotalUsdcSpent {} => to_json_binary(&TOTAL_USDC_SPENT.load(deps.storage)?),
        QueryMsg::SimulateSwap { usdc_in } => {
            to_json_binary(&query_simulate_swap(deps, usdc_in)?)
        }
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let c = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        owner: c.owner,
        cl8y_token: c.cl8y_token,
        usdc_denom: c.usdc_denom,
        destination: c.destination,
        price: c.price,
    })
}

fn query_simulate_swap(deps: Deps, usdc_in: Uint128) -> StdResult<SimulateSwapResponse> {
    let config = CONFIG.load(deps.storage)?;
    let cl8y_out = compute_cl8y_out(usdc_in, config.price)
        .map_err(|e| StdError::generic_err(e.to_string()))?;
    Ok(SimulateSwapResponse { cl8y_out })
}

// ============ HELPERS ============

fn assert_owner(info: &MessageInfo, owner: &cosmwasm_std::Addr) -> Result<(), ContractError> {
    if info.sender != *owner {
        return Err(ContractError::Unauthorized {});
    }
    Ok(())
}

fn parse_usdc_funds(funds: &[Coin], expected_denom: &str) -> Result<Uint128, ContractError> {
    if funds.is_empty() {
        return Err(ContractError::NoFunds {});
    }
    if funds.len() != 1 {
        return Err(ContractError::InvalidFunds {
            expected: expected_denom.to_string(),
        });
    }
    let coin = &funds[0];
    if coin.denom != expected_denom || coin.amount.is_zero() {
        return Err(ContractError::InvalidFunds {
            expected: expected_denom.to_string(),
        });
    }
    Ok(coin.amount)
}

/// cl8y_out = usdc_in_micro * 10^18 / price  (floored)
pub fn compute_cl8y_out(usdc_in: Uint128, price: Uint128) -> Result<Uint128, ContractError> {
    if price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }
    let numerator = Uint256::from(usdc_in) * Uint256::from(CL8Y_UNIT);
    let out = numerator / Uint256::from(price);
    out.try_into().map_err(|_| ContractError::Overflow {})
}

// ============ TESTS ============

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{from_json, Addr, ContractResult, QuerierResult, SystemResult, WasmQuery};

    const OWNER: &str = "terra1owner000000000000000000000000000000000";
    const USER: &str = "terra1user00000000000000000000000000000000";
    const DEST: &str = "terra1dest000000000000000000000000000000000";
    const CL8Y: &str = "terra1cl8y00000000000000000000000000000000";
    const USDC: &str = "ibc/0BB9D8513E8E8E9AE6A9D211D9136E6DA42288DDE6CFAA453A150A4566054DC5";

    fn default_instantiate_msg() -> InstantiateMsg {
        InstantiateMsg {
            owner: OWNER.to_string(),
            cl8y_token: CL8Y.to_string(),
            usdc_denom: USDC.to_string(),
            destination: DEST.to_string(),
            price: None,
        }
    }

    fn setup(deps: DepsMut, cl8y_balance: u128) {
        instantiate(deps, mock_env(), mock_info("creator", &[]), default_instantiate_msg())
            .unwrap();
        // mock querier will be set per-test
        let _ = cl8y_balance;
    }

    fn mock_cl8y_balance(balance: u128) -> impl Fn(&WasmQuery) -> QuerierResult {
        move |query| {
            if let WasmQuery::Smart { contract_addr, msg } = query {
                if contract_addr == CL8Y {
                    let req: Cw20QueryMsg = from_json(msg).unwrap();
                    if let Cw20QueryMsg::Balance { address: _ } = req {
                        let resp = cw20::BalanceResponse {
                            balance: Uint128::from(balance),
                        };
                        return SystemResult::Ok(ContractResult::Ok(
                            to_json_binary(&resp).unwrap(),
                        ));
                    }
                }
            }
            SystemResult::Err(cosmwasm_std::SystemError::UnsupportedRequest {
                kind: "wasm".to_string(),
            })
        }
    }

    #[test]
    fn instantiate_default_price() {
        let mut deps = mock_dependencies();
        instantiate(
            deps.as_mut(),
            mock_env(),
            mock_info("creator", &[]),
            default_instantiate_msg(),
        )
        .unwrap();
        let config = CONFIG.load(&deps.storage).unwrap();
        assert_eq!(config.price, Uint128::from(DEFAULT_PRICE));
        assert_eq!(config.owner, Addr::unchecked(OWNER));
        assert_eq!(TOTAL_USDC_SPENT.load(&deps.storage).unwrap(), Uint128::zero());
    }

    #[test]
    fn compute_cl8y_out_zero_usdc() {
        let out = compute_cl8y_out(Uint128::zero(), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::zero());
    }

    #[test]
    fn compute_cl8y_out_zero_price_errors() {
        let err = compute_cl8y_out(Uint128::new(700_000), Uint128::zero()).unwrap_err();
        assert_eq!(err, ContractError::InvalidPrice {});
    }

    #[test]
    fn compute_cl8y_out_one_cl8y() {
        // 0.70 USDC = 700_000 micro -> 1 CL8Y
        let out = compute_cl8y_out(Uint128::new(700_000), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_rounding() {
        // 1 micro-USDC at price 700_000 -> floor(1e18 / 700_000)
        let out = compute_cl8y_out(Uint128::one(), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(1_428_571_428_571));
    }

    #[test]
    fn compute_cl8y_out_one_usdc_at_default_price() {
        // 1 USDC = 1_000_000 micro -> ~1.428571 CL8Y
        let out = compute_cl8y_out(Uint128::new(1_000_000), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(1_428_571_428_571_428_571));
    }

    #[test]
    fn compute_cl8y_out_ten_cl8y_for_seven_usdc() {
        // 7 USDC at 0.70/CL8Y -> exactly 10 CL8Y
        let out = compute_cl8y_out(Uint128::new(7_000_000), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT * 10));
    }

    #[test]
    fn compute_cl8y_out_one_usdc_per_cl8y_price() {
        // price = 1_000_000 micro-USDC (1 USDC per CL8Y)
        let out = compute_cl8y_out(Uint128::new(1_000_000), Uint128::new(1_000_000)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_floors_just_below_one_cl8y() {
        // 699_999 micro < 700_000 price -> still less than 1 whole CL8Y
        let out = compute_cl8y_out(Uint128::new(699_999), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(999_998_571_428_571_428));
        assert!(out < Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_just_above_one_cl8y() {
        let out = compute_cl8y_out(Uint128::new(700_001), Uint128::new(700_000)).unwrap();
        assert_eq!(out, Uint128::new(1_000_001_428_571_428_571));
        assert!(out > Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_scales_linearly_with_usdc() {
        let price = Uint128::new(700_000);
        let one = compute_cl8y_out(Uint128::new(700_000), price).unwrap();
        let two = compute_cl8y_out(Uint128::new(1_400_000), price).unwrap();
        assert_eq!(two, one + one);
    }

    #[test]
    fn compute_cl8y_out_inverse_n_cl8y_costs_n_times_price() {
        // Buying N whole CL8Y costs exactly N * price micro-USDC (no rounding loss).
        let price = Uint128::new(700_000);
        for n in 1u128..=20 {
            let usdc = Uint128::new(n * 700_000);
            let out = compute_cl8y_out(usdc, price).unwrap();
            assert_eq!(out, Uint128::new(n * CL8Y_UNIT), "failed at n={n}");
        }
    }

    #[test]
    fn compute_cl8y_out_various_prices() {
        let cases: &[(u128, u128, u128)] = &[
            // (usdc_micro, price_micro, expected_cl8y_base)
            (700_000, 700_000, CL8Y_UNIT),
            (1_000_000, 1_000_000, CL8Y_UNIT),
            (500_000, 1_000_000, CL8Y_UNIT / 2),
            (2_000_000, 500_000, CL8Y_UNIT * 4),
            (3, 2, CL8Y_UNIT * 3 / 2), // price = 2 micro-USDC per CL8Y
        ];
        for (usdc, price, expected) in cases {
            let out = compute_cl8y_out(Uint128::new(*usdc), Uint128::new(*price)).unwrap();
            assert_eq!(out, Uint128::new(*expected), "usdc={usdc} price={price}");
        }
    }

    #[test]
    fn compute_cl8y_out_overflow_when_result_exceeds_u128() {
        // usdc * 10^18 / price must fit in Uint128
        let err = compute_cl8y_out(Uint128::MAX, Uint128::one()).unwrap_err();
        assert_eq!(err, ContractError::Overflow {});
    }

    #[test]
    fn compute_cl8y_out_large_realistic_swap() {
        // 1_000_000 USDC (1e12 micro) at default price
        let out = compute_cl8y_out(Uint128::new(1_000_000_000_000), Uint128::new(700_000)).unwrap();
        // 1e12 * 1e18 / 700_000 = 1e30 / 7e5 ≈ 1.428571e24 base units ≈ 1.428571e6 CL8Y
        assert_eq!(out, Uint128::new(1_428_571_428_571_428_571_428_571));
    }

    #[test]
    fn update_rate_owner_only() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut(), 0);

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[]),
            ExecuteMsg::UpdateRate {
                price: Uint128::new(800_000),
            },
        )
        .unwrap_err();
        assert_eq!(err, ContractError::Unauthorized {});

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(OWNER, &[]),
            ExecuteMsg::UpdateRate {
                price: Uint128::new(800_000),
            },
        )
        .unwrap();
        assert_eq!(
            CONFIG.load(&deps.storage).unwrap().price,
            Uint128::new(800_000)
        );
    }

    #[test]
    fn update_destination_owner_only() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut(), 0);

        let new_dest = "terra1newdest000000000000000000000000000";
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(OWNER, &[]),
            ExecuteMsg::UpdateDestination {
                destination: new_dest.to_string(),
            },
        )
        .unwrap();
        assert_eq!(
            CONFIG.load(&deps.storage).unwrap().destination,
            Addr::unchecked(new_dest)
        );
    }

    #[test]
    fn swap_success() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT * 10));
        setup(deps.as_mut(), CL8Y_UNIT * 10);

        let usdc = Coin {
            denom: USDC.to_string(),
            amount: Uint128::new(700_000),
        };
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[usdc]),
            ExecuteMsg::Swap {},
        )
        .unwrap();

        assert_eq!(res.messages.len(), 2);
        assert_eq!(
            TOTAL_USDC_SPENT.load(&deps.storage).unwrap(),
            Uint128::new(700_000)
        );
    }

    #[test]
    fn swap_insufficient_cl8y() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(0));
        setup(deps.as_mut(), 0);

        let usdc = Coin {
            denom: USDC.to_string(),
            amount: Uint128::new(700_000),
        };
        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[usdc]),
            ExecuteMsg::Swap {},
        )
        .unwrap_err();
        assert_eq!(err, ContractError::InsufficientCl8y {});
    }

    #[test]
    fn swap_no_funds() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut(), CL8Y_UNIT);

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[]),
            ExecuteMsg::Swap {},
        )
        .unwrap_err();
        assert_eq!(err, ContractError::NoFunds {});
    }

    #[test]
    fn swap_wrong_denom() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut(), CL8Y_UNIT);

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[Coin::new(100, "uluna")]),
            ExecuteMsg::Swap {},
        )
        .unwrap_err();
        assert!(matches!(err, ContractError::InvalidFunds { .. }));
    }

    #[test]
    fn simulate_swap_query() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut(), 0);

        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::SimulateSwap {
                usdc_in: Uint128::new(700_000),
            },
        )
        .unwrap();
        let sim: SimulateSwapResponse = from_json(&res).unwrap();
        assert_eq!(sim.cl8y_out, Uint128::new(CL8Y_UNIT));
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use cosmwasm_std::coin;
    use cosmwasm_std::Addr;
    use cw20_base::msg::{ExecuteMsg as Cw20ExecuteMsgBase, InstantiateMsg as Cw20InstantiateMsg};
    use cw_multi_test::{App, BankSudo, ContractWrapper, Executor, SudoMsg};

    const OWNER: &str = "terra1owner000000000000000000000000000000000";
    const USER: &str = "terra1user00000000000000000000000000000000";
    const DEST: &str = "terra1dest000000000000000000000000000000000";
    const USDC: &str = "ibc/0BB9D8513E8E8E9AE6A9D211D9136E6DA42288DDE6CFAA453A150A4566054DC5";

    fn otc_contract() -> Box<dyn cw_multi_test::Contract<cosmwasm_std::Empty>> {
        let contract = ContractWrapper::new(execute, instantiate, query);
        Box::new(contract)
    }

    fn cw20_contract() -> Box<dyn cw_multi_test::Contract<cosmwasm_std::Empty>> {
        let contract = ContractWrapper::new(
            cw20_base::contract::execute,
            cw20_base::contract::instantiate,
            cw20_base::contract::query,
        );
        Box::new(contract)
    }

    struct TestEnv {
        app: App,
        otc: Addr,
        cl8y: Addr,
    }

    fn setup_integration() -> TestEnv {
        let mut app = App::default();

        let cw20_id = app.store_code(cw20_contract());
        let cl8y = app
            .instantiate_contract(
                cw20_id,
                Addr::unchecked(OWNER),
                &Cw20InstantiateMsg {
                    name: "CL8Y".to_string(),
                    symbol: "CLY".to_string(),
                    decimals: 18,
                    initial_balances: vec![cw20::Cw20Coin {
                        address: OWNER.to_string(),
                        amount: Uint128::new(CL8Y_UNIT * 100),
                    }],
                    mint: None,
                    marketing: None,
                },
                &[],
                "cl8y",
                None,
            )
            .unwrap();

        let otc_id = app.store_code(otc_contract());
        let otc = app
            .instantiate_contract(
                otc_id,
                Addr::unchecked(OWNER),
                &InstantiateMsg {
                    owner: OWNER.to_string(),
                    cl8y_token: cl8y.to_string(),
                    usdc_denom: USDC.to_string(),
                    destination: DEST.to_string(),
                    price: None,
                },
                &[],
                "cl8y-otc",
                None,
            )
            .unwrap();

        // Fund OTC with CL8Y
        app.execute_contract(
            Addr::unchecked(OWNER),
            cl8y.clone(),
            &Cw20ExecuteMsgBase::Transfer {
                recipient: otc.to_string(),
                amount: Uint128::new(CL8Y_UNIT * 50),
            },
            &[],
        )
        .unwrap();

        // Fund user with USDC
        app.sudo(SudoMsg::Bank(BankSudo::Mint {
            to_address: USER.to_string(),
            amount: vec![coin(10_000_000, USDC)], // 10 USDC
        }))
        .unwrap();

        TestEnv { app, otc, cl8y }
    }

    #[test]
    fn integration_swap_forwards_usdc_and_mints_cl8y() {
        let mut env = setup_integration();

        env.app
            .execute_contract(
                Addr::unchecked(USER),
                env.otc.clone(),
                &ExecuteMsg::Swap {},
                &[coin(700_000, USDC)],
            )
            .unwrap();

        let user_cl8y: cw20::BalanceResponse = env
            .app
            .wrap()
            .query_wasm_smart(
                env.cl8y.clone(),
                &Cw20QueryMsg::Balance {
                    address: USER.to_string(),
                },
            )
            .unwrap();
        assert_eq!(user_cl8y.balance, Uint128::new(CL8Y_UNIT));

        let dest_usdc = env.app.wrap().query_balance(DEST, USDC).unwrap();
        assert_eq!(dest_usdc.amount, Uint128::new(700_000));

        let total: Uint128 = env
            .app
            .wrap()
            .query_wasm_smart(env.otc.clone(), &QueryMsg::TotalUsdcSpent {})
            .unwrap();
        assert_eq!(total, Uint128::new(700_000));
    }

    #[test]
    fn integration_swap_reverts_insufficient_cl8y() {
        let mut env = setup_integration();

        // Drain CL8Y from OTC
        let otc_balance: cw20::BalanceResponse = env
            .app
            .wrap()
            .query_wasm_smart(
                env.cl8y.clone(),
                &Cw20QueryMsg::Balance {
                    address: env.otc.to_string(),
                },
            )
            .unwrap();
        env.app
            .execute_contract(
                Addr::unchecked(OWNER),
                env.otc.clone(),
                &ExecuteMsg::WithdrawCl8y {
                    amount: otc_balance.balance,
                },
                &[],
            )
            .unwrap();

        let err = env
            .app
            .execute_contract(
                Addr::unchecked(USER),
                env.otc.clone(),
                &ExecuteMsg::Swap {},
                &[coin(700_000, USDC)],
            )
            .unwrap_err();
        assert!(err.root_cause().to_string().contains("Insufficient CL8Y"));
    }
}
