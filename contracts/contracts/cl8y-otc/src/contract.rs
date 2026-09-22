//! CL8Y OTC swap contract — CL8Y bridged USDT (CW20, 18 decimals) for CL8Y.

#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    from_json, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult, Uint128, Uint256, WasmMsg,
};
use cw2::set_contract_version;
use cw20::{Cw20ExecuteMsg, Cw20QueryMsg, Cw20ReceiveMsg};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, Cw20HookMsg, ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg,
    SimulateSwapResponse,
};
use crate::state::{
    Config, CL8Y_UNIT, CONFIG, CONTRACT_NAME, CONTRACT_VERSION, DEFAULT_PRICE, LEGACY_CONFIG,
    LEGACY_PRICE_SCALE, NOBLE_USDC_DENOM, TOTAL_USDC_SPENT, TOTAL_USDT_SPENT,
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

    let cl8y_token = deps.api.addr_validate(&msg.cl8y_token)?;
    let usdt_token = deps.api.addr_validate(&msg.usdt_token)?;
    if cl8y_token == usdt_token {
        return Err(ContractError::InvalidTokenConfig {});
    }

    let config = Config {
        owner: deps.api.addr_validate(&msg.owner)?,
        cl8y_token,
        usdt_token,
        destination: deps.api.addr_validate(&msg.destination)?,
        price,
    };

    CONFIG.save(deps.storage, &config)?;
    TOTAL_USDT_SPENT.save(deps.storage, &Uint128::zero())?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("owner", config.owner)
        .add_attribute("usdt_token", config.usdt_token)
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
        ExecuteMsg::Receive(msg) => execute_receive(deps, env, info, msg),
        ExecuteMsg::UpdateRate { price } => execute_update_rate(deps, info, price),
        ExecuteMsg::UpdateDestination { destination } => {
            execute_update_destination(deps, info, destination)
        }
        ExecuteMsg::WithdrawCl8y { amount } => execute_withdraw_cl8y(deps, info, amount),
        ExecuteMsg::WithdrawUsdt { amount } => execute_withdraw_usdt(deps, info, amount),
    }
}

fn execute_receive(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: Cw20ReceiveMsg,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.usdt_token {
        return Err(ContractError::Unauthorized {});
    }
    if !info.funds.is_empty() {
        return Err(ContractError::UnexpectedFunds {});
    }

    let hook: Cw20HookMsg = from_json(&msg.msg).map_err(|_| ContractError::InvalidHook {})?;
    match hook {
        Cw20HookMsg::Swap {} => {
            let payer = deps.api.addr_validate(&msg.sender)?;
            execute_swap(deps, env, payer, msg.amount)
        }
    }
}

fn execute_swap(
    deps: DepsMut,
    env: Env,
    payer: cosmwasm_std::Addr,
    usdt_in: Uint128,
) -> Result<Response, ContractError> {
    if usdt_in.is_zero() {
        return Err(ContractError::NoFunds {});
    }

    let config = CONFIG.load(deps.storage)?;
    let cl8y_out = compute_cl8y_out(usdt_in, config.price)?;

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
            recipient: payer.to_string(),
            amount: cl8y_out,
        })?,
        funds: vec![],
    };

    let forward_usdt = WasmMsg::Execute {
        contract_addr: config.usdt_token.to_string(),
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
            recipient: config.destination.to_string(),
            amount: usdt_in,
        })?,
        funds: vec![],
    };

    let total = TOTAL_USDT_SPENT.load(deps.storage)?;
    TOTAL_USDT_SPENT.save(deps.storage, &(total + usdt_in))?;

    Ok(Response::new()
        .add_message(transfer_cl8y)
        .add_message(forward_usdt)
        .add_attribute("action", "swap")
        .add_attribute("sender", payer)
        .add_attribute("usdt_in", usdt_in)
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

fn execute_withdraw_usdt(
    deps: DepsMut,
    info: MessageInfo,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    assert_owner(&info, &config.owner)?;

    let transfer = WasmMsg::Execute {
        contract_addr: config.usdt_token.to_string(),
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
            recipient: config.owner.to_string(),
            amount,
        })?,
        funds: vec![],
    };

    Ok(Response::new()
        .add_message(transfer)
        .add_attribute("action", "withdraw_usdt")
        .add_attribute("amount", amount))
}

// ============ QUERY ============

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::TotalUsdtSpent {} => to_json_binary(&TOTAL_USDT_SPENT.load(deps.storage)?),
        QueryMsg::SimulateSwap { usdt_in } => to_json_binary(&query_simulate_swap(deps, usdt_in)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let c = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        owner: c.owner,
        cl8y_token: c.cl8y_token,
        usdt_token: c.usdt_token,
        destination: c.destination,
        price: c.price,
    })
}

// ============ MIGRATE ============

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(deps: DepsMut, _env: Env, msg: MigrateMsg) -> Result<Response, ContractError> {
    let from_version =
        cw2::ensure_from_older_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    let from_version = from_version.to_string();
    if from_version == CONTRACT_VERSION {
        return Err(ContractError::AlreadyMigrated {});
    }
    if from_version != "0.1.0" {
        return Err(ContractError::UnsupportedVersion {
            version: from_version,
        });
    }

    let legacy = LEGACY_CONFIG.load(deps.storage)?;
    if legacy.usdc_denom != NOBLE_USDC_DENOM {
        return Err(ContractError::UnexpectedLegacyDenom {});
    }
    if legacy.price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }

    let usdt_token = deps.api.addr_validate(&msg.usdt_token)?;
    if usdt_token == legacy.cl8y_token {
        return Err(ContractError::InvalidTokenConfig {});
    }

    let price = match msg.price {
        Some(price) => {
            if price.is_zero() {
                return Err(ContractError::InvalidPrice {});
            }
            price
        }
        None => legacy
            .price
            .checked_mul(Uint128::new(LEGACY_PRICE_SCALE))
            .map_err(|_| ContractError::Overflow {})?,
    };

    let prior_usdc = TOTAL_USDC_SPENT.may_load(deps.storage)?.unwrap_or_default();
    TOTAL_USDC_SPENT.remove(deps.storage);

    let config = Config {
        owner: legacy.owner,
        cl8y_token: legacy.cl8y_token,
        usdt_token,
        destination: legacy.destination,
        price,
    };
    CONFIG.save(deps.storage, &config)?;
    TOTAL_USDT_SPENT.save(deps.storage, &Uint128::zero())?;

    Ok(Response::new()
        .add_attribute("action", "migrate")
        .add_attribute("from_version", from_version)
        .add_attribute("to_version", CONTRACT_VERSION)
        .add_attribute("usdt_token", config.usdt_token)
        .add_attribute("price", price)
        .add_attribute("prior_usdc_micro", prior_usdc))
}

fn query_simulate_swap(deps: Deps, usdt_in: Uint128) -> StdResult<SimulateSwapResponse> {
    let config = CONFIG.load(deps.storage)?;
    let cl8y_out = compute_cl8y_out(usdt_in, config.price)
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

/// cl8y_out = usdt_in * 10^18 / price  (floored)
///
/// `price` is USDT base units (18 decimals) per 1 whole CL8Y.
pub fn compute_cl8y_out(usdt_in: Uint128, price: Uint128) -> Result<Uint128, ContractError> {
    if price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }
    let numerator = Uint256::from(usdt_in) * Uint256::from(CL8Y_UNIT);
    let out = numerator / Uint256::from(price);
    out.try_into().map_err(|_| ContractError::Overflow {})
}

// ============ TESTS ============

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::LegacyConfig;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{
        coin, from_json, Addr, ContractResult, QuerierResult, SystemResult, WasmQuery,
    };
    use cw20::Cw20ExecuteMsg;

    const OWNER: &str = "terra1owner000000000000000000000000000000000";
    const USER: &str = "terra1user00000000000000000000000000000000";
    const DEST: &str = "terra1dest000000000000000000000000000000000";
    const CL8Y: &str = "terra1cl8y00000000000000000000000000000000";
    const USDT: &str = "terra1usdt00000000000000000000000000000000";

    fn default_instantiate_msg() -> InstantiateMsg {
        InstantiateMsg {
            owner: OWNER.to_string(),
            cl8y_token: CL8Y.to_string(),
            usdt_token: USDT.to_string(),
            destination: DEST.to_string(),
            price: None,
        }
    }

    fn setup(deps: DepsMut) {
        instantiate(
            deps,
            mock_env(),
            mock_info("creator", &[]),
            default_instantiate_msg(),
        )
        .unwrap();
    }

    fn swap_msg(amount: u128) -> ExecuteMsg {
        ExecuteMsg::Receive(Cw20ReceiveMsg {
            sender: USER.to_string(),
            amount: Uint128::new(amount),
            msg: to_json_binary(&Cw20HookMsg::Swap {}).unwrap(),
        })
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
        assert_eq!(DEFAULT_PRICE, 7 * 10u128.pow(17));
        assert_eq!(config.owner, Addr::unchecked(OWNER));
        assert_eq!(config.usdt_token, Addr::unchecked(USDT));
        assert_eq!(
            TOTAL_USDT_SPENT.load(&deps.storage).unwrap(),
            Uint128::zero()
        );
    }

    #[test]
    fn instantiate_rejects_same_payment_and_reward_token() {
        let mut deps = mock_dependencies();
        let mut msg = default_instantiate_msg();
        msg.usdt_token = CL8Y.to_string();
        let err =
            instantiate(deps.as_mut(), mock_env(), mock_info("creator", &[]), msg).unwrap_err();
        assert_eq!(err, ContractError::InvalidTokenConfig {});
    }

    #[test]
    fn compute_cl8y_out_zero_usdt() {
        let out = compute_cl8y_out(Uint128::zero(), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::zero());
    }

    #[test]
    fn compute_cl8y_out_zero_price_errors() {
        let err = compute_cl8y_out(Uint128::new(DEFAULT_PRICE), Uint128::zero()).unwrap_err();
        assert_eq!(err, ContractError::InvalidPrice {});
    }

    #[test]
    fn compute_cl8y_out_one_cl8y() {
        // 0.70 USDT = 7e17 base units -> 1 CL8Y
        let out =
            compute_cl8y_out(Uint128::new(DEFAULT_PRICE), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_rounding() {
        // 1 base unit at default price -> floor(1e18 / 7e17) = 1
        let out = compute_cl8y_out(Uint128::one(), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::one());
    }

    #[test]
    fn compute_cl8y_out_one_usdt_at_default_price() {
        // 1 USDT = 1e18 base units -> ~1.428571 CL8Y
        let out = compute_cl8y_out(Uint128::new(CL8Y_UNIT), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(1_428_571_428_571_428_571));
    }

    #[test]
    fn compute_cl8y_out_ten_cl8y_for_seven_usdt() {
        // 7 USDT at 0.70/CL8Y -> exactly 10 CL8Y
        let out =
            compute_cl8y_out(Uint128::new(CL8Y_UNIT * 7), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT * 10));
    }

    #[test]
    fn compute_cl8y_out_one_usdt_per_cl8y_price() {
        // price = 1e18 (1 USDT per CL8Y)
        let out = compute_cl8y_out(Uint128::new(CL8Y_UNIT), Uint128::new(CL8Y_UNIT)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_floors_just_below_one_cl8y() {
        // 10^18 is not divisible by the price, so one base unit under the price
        // floors two base units short of 1 CL8Y.
        let out =
            compute_cl8y_out(Uint128::new(DEFAULT_PRICE - 1), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT - 2));
        assert!(out < Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_just_above_one_cl8y() {
        let out =
            compute_cl8y_out(Uint128::new(DEFAULT_PRICE + 1), Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(CL8Y_UNIT + 1));
        assert!(out > Uint128::new(CL8Y_UNIT));
    }

    #[test]
    fn compute_cl8y_out_scales_linearly_with_usdt() {
        let price = Uint128::new(DEFAULT_PRICE);
        let one = compute_cl8y_out(Uint128::new(DEFAULT_PRICE), price).unwrap();
        let two = compute_cl8y_out(Uint128::new(DEFAULT_PRICE * 2), price).unwrap();
        assert_eq!(two, one + one);
    }

    #[test]
    fn compute_cl8y_out_inverse_n_cl8y_costs_n_times_price() {
        let price = Uint128::new(DEFAULT_PRICE);
        for n in 1u128..=20 {
            let usdt = Uint128::new(n * DEFAULT_PRICE);
            let out = compute_cl8y_out(usdt, price).unwrap();
            assert_eq!(out, Uint128::new(n * CL8Y_UNIT), "failed at n={n}");
        }
    }

    #[test]
    fn compute_cl8y_out_various_prices() {
        let cases: &[(u128, u128, u128)] = &[
            (DEFAULT_PRICE, DEFAULT_PRICE, CL8Y_UNIT),
            (CL8Y_UNIT, CL8Y_UNIT, CL8Y_UNIT),
            (CL8Y_UNIT / 2, CL8Y_UNIT, CL8Y_UNIT / 2),
            (CL8Y_UNIT * 4, CL8Y_UNIT / 2, CL8Y_UNIT * 8),
            (3, 2, CL8Y_UNIT * 3 / 2),
        ];
        for (usdt, price, expected) in cases {
            let out = compute_cl8y_out(Uint128::new(*usdt), Uint128::new(*price)).unwrap();
            assert_eq!(out, Uint128::new(*expected), "usdt={usdt} price={price}");
        }
    }

    #[test]
    fn compute_cl8y_out_overflow_when_result_exceeds_u128() {
        let err = compute_cl8y_out(Uint128::MAX, Uint128::one()).unwrap_err();
        assert_eq!(err, ContractError::Overflow {});
    }

    #[test]
    fn compute_cl8y_out_large_realistic_swap() {
        // 1_000_000 USDT at default price
        let usdt_in = Uint128::new(1_000_000) * Uint128::new(CL8Y_UNIT);
        let out = compute_cl8y_out(usdt_in, Uint128::new(DEFAULT_PRICE)).unwrap();
        assert_eq!(out, Uint128::new(1_428_571_428_571_428_571_428_571));
    }

    #[test]
    fn update_rate_owner_only() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut());

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
        setup(deps.as_mut());

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
        setup(deps.as_mut());

        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USDT, &[]),
            swap_msg(DEFAULT_PRICE),
        )
        .unwrap();

        assert_eq!(res.messages.len(), 2);
        match &res.messages[0].msg {
            cosmwasm_std::CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr,
                msg,
                funds,
            }) => {
                assert_eq!(contract_addr, CL8Y);
                assert!(funds.is_empty());
                let parsed: Cw20ExecuteMsg = from_json(msg).unwrap();
                match parsed {
                    Cw20ExecuteMsg::Transfer { recipient, amount } => {
                        assert_eq!(recipient, USER);
                        assert_eq!(amount, Uint128::new(CL8Y_UNIT));
                    }
                    _ => panic!("expected CL8Y transfer"),
                }
            }
            _ => panic!("expected wasm execute"),
        }
        match &res.messages[1].msg {
            cosmwasm_std::CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr,
                msg,
                funds,
            }) => {
                assert_eq!(contract_addr, USDT);
                assert!(funds.is_empty());
                let parsed: Cw20ExecuteMsg = from_json(msg).unwrap();
                match parsed {
                    Cw20ExecuteMsg::Transfer { recipient, amount } => {
                        assert_eq!(recipient, DEST);
                        assert_eq!(amount, Uint128::new(DEFAULT_PRICE));
                    }
                    _ => panic!("expected USDT transfer"),
                }
            }
            _ => panic!("expected wasm execute"),
        }
        assert_eq!(
            TOTAL_USDT_SPENT.load(&deps.storage).unwrap(),
            Uint128::new(DEFAULT_PRICE)
        );
    }

    #[test]
    fn swap_rejects_sender_other_than_usdt_token() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut());

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USER, &[]),
            swap_msg(DEFAULT_PRICE),
        )
        .unwrap_err();
        assert_eq!(err, ContractError::Unauthorized {});
    }

    #[test]
    fn swap_rejects_native_funds() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut());

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USDT, &[coin(1, "uluna")]),
            swap_msg(DEFAULT_PRICE),
        )
        .unwrap_err();
        assert_eq!(err, ContractError::UnexpectedFunds {});
    }

    #[test]
    fn swap_rejects_invalid_hook() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut());

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USDT, &[]),
            ExecuteMsg::Receive(Cw20ReceiveMsg {
                sender: USER.to_string(),
                amount: Uint128::new(DEFAULT_PRICE),
                msg: to_json_binary(&"nope").unwrap(),
            }),
        )
        .unwrap_err();
        assert_eq!(err, ContractError::InvalidHook {});
    }

    #[test]
    fn swap_rejects_zero_amount() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        setup(deps.as_mut());

        let err =
            execute(deps.as_mut(), mock_env(), mock_info(USDT, &[]), swap_msg(0)).unwrap_err();
        assert_eq!(err, ContractError::NoFunds {});
    }

    #[test]
    fn swap_insufficient_cl8y() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(0));
        setup(deps.as_mut());

        let err = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USDT, &[]),
            swap_msg(DEFAULT_PRICE),
        )
        .unwrap_err();
        assert_eq!(err, ContractError::InsufficientCl8y {});
    }

    #[test]
    fn simulate_swap_query() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut());

        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::SimulateSwap {
                usdt_in: Uint128::new(DEFAULT_PRICE),
            },
        )
        .unwrap();
        let sim: SimulateSwapResponse = from_json(&res).unwrap();
        assert_eq!(sim.cl8y_out, Uint128::new(CL8Y_UNIT));
    }

    fn setup_legacy(deps: DepsMut, price: u128, usdc_spent: u128) {
        set_contract_version(deps.storage, CONTRACT_NAME, "0.1.0").unwrap();
        LEGACY_CONFIG
            .save(
                deps.storage,
                &LegacyConfig {
                    owner: Addr::unchecked(OWNER),
                    cl8y_token: Addr::unchecked(CL8Y),
                    usdc_denom: NOBLE_USDC_DENOM.to_string(),
                    destination: Addr::unchecked(DEST),
                    price: Uint128::new(price),
                },
            )
            .unwrap();
        TOTAL_USDC_SPENT
            .save(deps.storage, &Uint128::new(usdc_spent))
            .unwrap();
    }

    fn migrate_msg() -> MigrateMsg {
        MigrateMsg {
            usdt_token: USDT.to_string(),
            price: None,
        }
    }

    #[test]
    fn migrate_scales_live_noble_price_and_keeps_address_state() {
        let mut deps = mock_dependencies();
        // On-chain values from terra1e6c... on 2026-09-22.
        let live_price = 711_700u128;
        let live_spent = 2_695_278_851u128;
        setup_legacy(deps.as_mut(), live_price, live_spent);

        let res = migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap();
        assert_eq!(res.attributes[0].value, "migrate");

        let config = CONFIG.load(&deps.storage).unwrap();
        assert_eq!(config.owner, Addr::unchecked(OWNER));
        assert_eq!(config.cl8y_token, Addr::unchecked(CL8Y));
        assert_eq!(config.destination, Addr::unchecked(DEST));
        assert_eq!(config.usdt_token, Addr::unchecked(USDT));
        assert_eq!(
            config.price,
            Uint128::new(live_price) * Uint128::new(LEGACY_PRICE_SCALE)
        );
        assert_eq!(
            TOTAL_USDT_SPENT.load(&deps.storage).unwrap(),
            Uint128::zero()
        );
        assert!(TOTAL_USDC_SPENT.may_load(&deps.storage).unwrap().is_none());

        let version = cw2::get_contract_version(&deps.storage).unwrap();
        assert_eq!(version.contract, CONTRACT_NAME);
        assert_eq!(version.version, "0.2.0");
    }

    #[test]
    fn migrate_then_swap_uses_scaled_price() {
        let mut deps = mock_dependencies();
        deps.querier.update_wasm(mock_cl8y_balance(CL8Y_UNIT));
        let live_price = 711_700u128;
        setup_legacy(deps.as_mut(), live_price, 0);
        migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap();

        let usdt_in = Uint128::new(live_price) * Uint128::new(LEGACY_PRICE_SCALE);
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(USDT, &[]),
            ExecuteMsg::Receive(Cw20ReceiveMsg {
                sender: USER.to_string(),
                amount: usdt_in,
                msg: to_json_binary(&Cw20HookMsg::Swap {}).unwrap(),
            }),
        )
        .unwrap();

        match &res.messages[0].msg {
            cosmwasm_std::CosmosMsg::Wasm(WasmMsg::Execute { msg, .. }) => {
                let parsed: Cw20ExecuteMsg = from_json(msg).unwrap();
                match parsed {
                    Cw20ExecuteMsg::Transfer { amount, .. } => {
                        assert_eq!(amount, Uint128::new(CL8Y_UNIT));
                    }
                    _ => panic!("expected CL8Y transfer"),
                }
            }
            _ => panic!("expected wasm execute"),
        }
    }

    #[test]
    fn migrate_explicit_price_overrides_scale() {
        let mut deps = mock_dependencies();
        setup_legacy(deps.as_mut(), 711_700, 0);
        migrate(
            deps.as_mut(),
            mock_env(),
            MigrateMsg {
                usdt_token: USDT.to_string(),
                price: Some(Uint128::new(DEFAULT_PRICE)),
            },
        )
        .unwrap();
        assert_eq!(
            CONFIG.load(&deps.storage).unwrap().price,
            Uint128::new(DEFAULT_PRICE)
        );
    }

    #[test]
    fn migrate_rejects_second_run() {
        let mut deps = mock_dependencies();
        setup_legacy(deps.as_mut(), 711_700, 0);
        migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap();
        let err = migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap_err();
        assert_eq!(err, ContractError::AlreadyMigrated {});
    }

    #[test]
    fn migrate_rejects_fresh_usdt_contract() {
        let mut deps = mock_dependencies();
        setup(deps.as_mut());
        let err = migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap_err();
        assert_eq!(err, ContractError::AlreadyMigrated {});
    }

    #[test]
    fn migrate_rejects_wrong_legacy_denom() {
        let mut deps = mock_dependencies();
        setup_legacy(deps.as_mut(), 711_700, 0);
        let mut legacy = LEGACY_CONFIG.load(&deps.storage).unwrap();
        legacy.usdc_denom = "uluna".to_string();
        LEGACY_CONFIG.save(&mut deps.storage, &legacy).unwrap();

        let err = migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap_err();
        assert_eq!(err, ContractError::UnexpectedLegacyDenom {});
    }

    #[test]
    fn migrate_rejects_unsupported_version() {
        let mut deps = mock_dependencies();
        setup_legacy(deps.as_mut(), 711_700, 0);
        set_contract_version(&mut deps.storage, CONTRACT_NAME, "0.0.9").unwrap();
        let err = migrate(deps.as_mut(), mock_env(), migrate_msg()).unwrap_err();
        assert_eq!(
            err,
            ContractError::UnsupportedVersion {
                version: "0.0.9".to_string(),
            }
        );
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use cosmwasm_std::Addr;
    use cw20_base::msg::{ExecuteMsg as Cw20ExecuteMsgBase, InstantiateMsg as Cw20InstantiateMsg};
    use cw_multi_test::{App, ContractWrapper, Executor};

    const OWNER: &str = "terra1owner000000000000000000000000000000000";
    const USER: &str = "terra1user00000000000000000000000000000000";
    const DEST: &str = "terra1dest000000000000000000000000000000000";

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
        usdt: Addr,
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

        let usdt = app
            .instantiate_contract(
                cw20_id,
                Addr::unchecked(OWNER),
                &Cw20InstantiateMsg {
                    name: "Tether USD".to_string(),
                    symbol: "USDT".to_string(),
                    decimals: 18,
                    initial_balances: vec![cw20::Cw20Coin {
                        address: USER.to_string(),
                        amount: Uint128::new(CL8Y_UNIT * 10),
                    }],
                    mint: None,
                    marketing: None,
                },
                &[],
                "usdt",
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
                    usdt_token: usdt.to_string(),
                    destination: DEST.to_string(),
                    price: None,
                },
                &[],
                "cl8y-otc",
                None,
            )
            .unwrap();

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

        TestEnv {
            app,
            otc,
            cl8y,
            usdt,
        }
    }

    fn send_usdt(
        env: &mut TestEnv,
        amount: u128,
    ) -> Result<cw_multi_test::AppResponse, cw_multi_test::error::AnyError> {
        env.app.execute_contract(
            Addr::unchecked(USER),
            env.usdt.clone(),
            &Cw20ExecuteMsgBase::Send {
                contract: env.otc.to_string(),
                amount: Uint128::new(amount),
                msg: to_json_binary(&Cw20HookMsg::Swap {}).unwrap(),
            },
            &[],
        )
    }

    #[test]
    fn integration_swap_forwards_usdt_and_sends_cl8y() {
        let mut env = setup_integration();

        send_usdt(&mut env, DEFAULT_PRICE).unwrap();

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

        let dest_usdt: cw20::BalanceResponse = env
            .app
            .wrap()
            .query_wasm_smart(
                env.usdt.clone(),
                &Cw20QueryMsg::Balance {
                    address: DEST.to_string(),
                },
            )
            .unwrap();
        assert_eq!(dest_usdt.balance, Uint128::new(DEFAULT_PRICE));

        let user_usdt: cw20::BalanceResponse = env
            .app
            .wrap()
            .query_wasm_smart(
                env.usdt.clone(),
                &Cw20QueryMsg::Balance {
                    address: USER.to_string(),
                },
            )
            .unwrap();
        assert_eq!(
            user_usdt.balance,
            Uint128::new(CL8Y_UNIT * 10 - DEFAULT_PRICE)
        );

        let total: Uint128 = env
            .app
            .wrap()
            .query_wasm_smart(env.otc.clone(), &QueryMsg::TotalUsdtSpent {})
            .unwrap();
        assert_eq!(total, Uint128::new(DEFAULT_PRICE));
    }

    #[test]
    fn integration_swap_reverts_insufficient_cl8y() {
        let mut env = setup_integration();

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

        let err = send_usdt(&mut env, DEFAULT_PRICE).unwrap_err();
        assert!(err.root_cause().to_string().contains("Insufficient CL8Y"));
    }
}
