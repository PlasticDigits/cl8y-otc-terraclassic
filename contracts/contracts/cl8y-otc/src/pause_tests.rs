//! Focused issue17 role, intake, legacy-state and migration checks. No chain RPC.
use super::*;
use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
use cosmwasm_std::{coin, Addr, Order, Storage};

const OWNER: &str = "owner";
const GUARDIAN: &str = "guardian";
const OTHER: &str = "other";
const USDT: &str = "usdt-token";

fn setup(deps: DepsMut) {
    instantiate(
        deps,
        mock_env(),
        mock_info("creator", &[]),
        InstantiateMsg {
            owner: OWNER.into(),
            cl8y_token: "cl8y-token".into(),
            usdt_token: USDT.into(),
            destination: "treasury".into(),
            price: Some(Uint128::new(DEFAULT_PRICE + 17)),
        },
    )
    .unwrap();
}

fn call(deps: DepsMut, actor: &str, msg: ExecuteMsg) -> Result<Response, ContractError> {
    execute(deps, mock_env(), mock_info(actor, &[]), msg)
}

fn guardian(value: Option<&str>) -> ExecuteMsg {
    ExecuteMsg::SetPauseGuardian {
        guardian: value.map(String::from),
    }
}

fn pause_upgrade() -> MigrateMsg {
    MigrateMsg::PauseUpgrade(PauseUpgradeMsg::PauseUpgrade {})
}

fn snapshot(storage: &dyn Storage) -> Vec<(Vec<u8>, Vec<u8>)> {
    storage.range(None, None, Order::Ascending).collect()
}

#[test]
fn pause17_missing_old_state_queries_default_without_writing() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    PAUSE_STATE.remove(&mut deps.storage);
    let before = snapshot(&deps.storage);
    let status: PauseStatusResponse =
        from_json(query(deps.as_ref(), mock_env(), QueryMsg::PauseStatus {}).unwrap()).unwrap();
    assert_eq!(
        status,
        PauseStatusResponse {
            paused: false,
            guardian: None
        }
    );
    assert_eq!(before, snapshot(&deps.storage));
    call(deps.as_mut(), OWNER, ExecuteMsg::Pause {}).unwrap();
    assert!(PAUSE_STATE.load(&deps.storage).unwrap().paused);
}

#[test]
fn pause17_guardian_only_pauses_owner_keeps_configuration_and_recovery() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    call(deps.as_mut(), OWNER, guardian(Some(GUARDIAN))).unwrap();
    call(deps.as_mut(), GUARDIAN, ExecuteMsg::Pause {}).unwrap();
    let original = CONFIG.load(&deps.storage).unwrap();
    for msg in [
        ExecuteMsg::Unpause {},
        guardian(Some(OTHER)),
        ExecuteMsg::UpdateRate {
            price: Uint128::one(),
        },
        ExecuteMsg::UpdateDestination {
            destination: OTHER.into(),
        },
        ExecuteMsg::WithdrawCl8y {
            amount: Uint128::one(),
        },
        ExecuteMsg::WithdrawUsdt {
            amount: Uint128::one(),
        },
    ] {
        assert_eq!(
            call(deps.as_mut(), GUARDIAN, msg).unwrap_err(),
            ContractError::Unauthorized {}
        );
    }
    assert_eq!(
        call(deps.as_mut(), OTHER, ExecuteMsg::Pause {}).unwrap_err(),
        ContractError::Unauthorized {}
    );
    assert_eq!(CONFIG.load(&deps.storage).unwrap(), original);
    // Quotes remain meaningful while paused; no existing config response fields change.
    let quote: SimulateSwapResponse = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::SimulateSwap {
                usdt_in: original.price,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(quote.cl8y_out, Uint128::new(CL8Y_UNIT));
    assert_eq!(
        call(
            deps.as_mut(),
            OWNER,
            ExecuteMsg::WithdrawCl8y {
                amount: Uint128::one()
            }
        )
        .unwrap()
        .messages
        .len(),
        1
    );
    assert_eq!(
        call(
            deps.as_mut(),
            OWNER,
            ExecuteMsg::WithdrawUsdt {
                amount: Uint128::one()
            }
        )
        .unwrap()
        .messages
        .len(),
        1
    );
    call(
        deps.as_mut(),
        OWNER,
        ExecuteMsg::UpdateDestination {
            destination: OTHER.into(),
        },
    )
    .unwrap();
    call(
        deps.as_mut(),
        OWNER,
        ExecuteMsg::UpdateRate {
            price: Uint128::new(DEFAULT_PRICE),
        },
    )
    .unwrap();
    call(deps.as_mut(), OWNER, ExecuteMsg::Unpause {}).unwrap();
    assert!(!PAUSE_STATE.load(&deps.storage).unwrap().paused);
}

#[test]
fn pause17_rotation_revocation_and_invalid_guardians_do_not_clear_latch() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    for address in [OWNER.to_string(), mock_env().contract.address.to_string()] {
        assert_eq!(
            call(deps.as_mut(), OWNER, guardian(Some(&address))).unwrap_err(),
            ContractError::InvalidPauseGuardian {}
        );
    }
    call(deps.as_mut(), OWNER, guardian(Some(GUARDIAN))).unwrap();
    call(deps.as_mut(), GUARDIAN, ExecuteMsg::Pause {}).unwrap();
    call(deps.as_mut(), OWNER, guardian(Some(OTHER))).unwrap();
    assert_eq!(
        call(deps.as_mut(), GUARDIAN, ExecuteMsg::Pause {}).unwrap_err(),
        ContractError::Unauthorized {}
    );
    call(deps.as_mut(), OTHER, ExecuteMsg::Pause {}).unwrap();
    call(deps.as_mut(), OWNER, guardian(None)).unwrap();
    assert_eq!(
        call(deps.as_mut(), OTHER, ExecuteMsg::Pause {}).unwrap_err(),
        ContractError::Unauthorized {}
    );
    assert_eq!(
        PAUSE_STATE.load(&deps.storage).unwrap(),
        PauseState {
            paused: true,
            guardian: None
        }
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(OWNER, &[coin(1, "uluna")]),
            ExecuteMsg::Unpause {}
        )
        .unwrap_err(),
        ContractError::UnexpectedFunds {}
    );
    assert!(PAUSE_STATE.load(&deps.storage).unwrap().paused);
}

#[test]
fn pause17_every_hook_and_internal_swap_fail_before_query_or_accounting() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    call(deps.as_mut(), OWNER, ExecuteMsg::Pause {}).unwrap();
    let before = snapshot(&deps.storage);
    for (amount, hook) in [
        (
            Uint128::one(),
            to_json_binary(&Cw20HookMsg::Swap {}).unwrap(),
        ),
        (Uint128::zero(), Binary::from(b"malformed hook".to_vec())),
    ] {
        assert_eq!(
            call(
                deps.as_mut(),
                USDT,
                ExecuteMsg::Receive(Cw20ReceiveMsg {
                    sender: OTHER.into(),
                    amount,
                    msg: hook
                })
            )
            .unwrap_err(),
            ContractError::Paused {}
        );
    }
    assert_eq!(
        execute_swap(
            deps.as_mut(),
            mock_env(),
            Addr::unchecked(OTHER),
            Uint128::one()
        )
        .unwrap_err(),
        ContractError::Paused {}
    );
    assert_eq!(
        call(
            deps.as_mut(),
            OTHER,
            ExecuteMsg::Receive(Cw20ReceiveMsg {
                sender: OTHER.into(),
                amount: Uint128::one(),
                msg: Binary::default()
            })
        )
        .unwrap_err(),
        ContractError::Unauthorized {}
    );
    assert_eq!(before, snapshot(&deps.storage));
}

#[test]
fn pause17_migrate_exact_v02_preserves_all_preexisting_bytes_and_accounting() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    PAUSE_STATE.remove(&mut deps.storage);
    cw2::set_contract_version(&mut deps.storage, CONTRACT_NAME, "0.2.0").unwrap();
    TOTAL_USDT_SPENT
        .save(&mut deps.storage, &Uint128::new(u128::MAX - 3))
        .unwrap();
    deps.storage
        .set(b"unrelated-existing-ledger", b"opaque-original-value");
    let original_config = deps.storage.get(b"config").unwrap();
    let original_total = deps.storage.get(b"total_usdt_spent").unwrap();
    let before: Vec<_> = snapshot(&deps.storage)
        .into_iter()
        .filter(|(key, _)| key != b"contract_info")
        .collect();
    migrate(deps.as_mut(), mock_env(), pause_upgrade()).unwrap();
    assert_eq!(deps.storage.get(b"config").unwrap(), original_config);
    assert_eq!(
        deps.storage.get(b"total_usdt_spent").unwrap(),
        original_total
    );
    let after: Vec<_> = snapshot(&deps.storage)
        .into_iter()
        .filter(|(key, _)| key != b"contract_info" && key != b"cl8y_otc_pause_v1")
        .collect();
    assert_eq!(before, after);
    assert_eq!(
        PAUSE_STATE.load(&deps.storage).unwrap(),
        PauseState::default()
    );
    assert_eq!(
        cw2::get_contract_version(&deps.storage).unwrap().version,
        CONTRACT_VERSION
    );
    assert_eq!(
        migrate(deps.as_mut(), mock_env(), pause_upgrade()).unwrap_err(),
        ContractError::AlreadyMigrated {}
    );
}

#[test]
fn pause17_migrate_rejects_wrong_identity_version_shape_or_existing_pause_without_writes() {
    let mut deps = mock_dependencies();
    setup(deps.as_mut());
    PAUSE_STATE.remove(&mut deps.storage);
    for old in ["0.1.0", "0.2.1", "0.3.1", "not-a-version"] {
        cw2::set_contract_version(&mut deps.storage, CONTRACT_NAME, old).unwrap();
        let before = snapshot(&deps.storage);
        assert_eq!(
            migrate(deps.as_mut(), mock_env(), pause_upgrade()).unwrap_err(),
            ContractError::UnsupportedVersion {
                version: old.into()
            }
        );
        assert_eq!(snapshot(&deps.storage), before);
    }
    cw2::set_contract_version(&mut deps.storage, "unrelated-contract", "0.2.0").unwrap();
    let before = snapshot(&deps.storage);
    assert!(migrate(deps.as_mut(), mock_env(), pause_upgrade()).is_err());
    assert_eq!(snapshot(&deps.storage), before);
    cw2::set_contract_version(&mut deps.storage, CONTRACT_NAME, "0.2.0").unwrap();
    let before = snapshot(&deps.storage);
    let legacy = MigrateMsg::LegacyUsdcToUsdt(LegacyMigrateMsg {
        usdt_token: USDT.into(),
        price: None,
    });
    assert!(matches!(
        migrate(deps.as_mut(), mock_env(), legacy),
        Err(ContractError::UnsupportedVersion { .. })
    ));
    assert_eq!(snapshot(&deps.storage), before);
    PAUSE_STATE
        .save(
            &mut deps.storage,
            &PauseState {
                paused: true,
                guardian: Some(Addr::unchecked(GUARDIAN)),
            },
        )
        .unwrap();
    let before = snapshot(&deps.storage);
    assert_eq!(
        migrate(deps.as_mut(), mock_env(), pause_upgrade()).unwrap_err(),
        ContractError::PauseStateExists {}
    );
    assert_eq!(snapshot(&deps.storage), before);
}

#[test]
fn pause17_wire_legacy_migration_remains_exact_and_upgrade_is_separate() {
    assert!(matches!(
        from_json::<MigrateMsg>(br#"{"usdt_token":"usdt-token","price":null}"#).unwrap(),
        MigrateMsg::LegacyUsdcToUsdt(_)
    ));
    assert_eq!(
        from_json::<MigrateMsg>(br#"{"pause_upgrade":{}}"#).unwrap(),
        pause_upgrade()
    );
    assert!(from_json::<MigrateMsg>(br#"{"pause_upgrade":{},"usdt_token":"usdt-token"}"#).is_err());
    assert_eq!(
        to_json_binary(&ExecuteMsg::Pause {}).unwrap(),
        Binary::from(br#"{"pause":{}}"#.to_vec())
    );
}
