use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Uint128};
use cw20::Cw20ReceiveMsg;

#[cw_serde]
pub struct InstantiateMsg {
    pub owner: String,
    pub cl8y_token: String,
    /// CL8Y bridged USDT CW20 (18 decimals).
    pub usdt_token: String,
    pub destination: String,
    /// USDT base units per 1 whole CL8Y. Defaults to 0.70 USDT (7 × 10^17).
    pub price: Option<Uint128>,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// CW20 receive hook. The USDT token calls this after `Send`.
    Receive(Cw20ReceiveMsg),
    /// Owner: update CL8Y price in USDT base units per whole token.
    UpdateRate { price: Uint128 },
    /// Owner: update USDT destination address.
    UpdateDestination { destination: String },
    /// Owner: withdraw CL8Y from contract inventory.
    WithdrawCl8y { amount: Uint128 },
    /// Owner: withdraw USDT that was transferred in without a swap hook.
    WithdrawUsdt { amount: Uint128 },
}

/// Payload wrapped in the USDT CW20 `Send` message.
#[cw_serde]
pub enum Cw20HookMsg {
    Swap {},
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},
    #[returns(Uint128)]
    TotalUsdtSpent {},
    #[returns(SimulateSwapResponse)]
    SimulateSwap { usdt_in: Uint128 },
}

#[cw_serde]
pub struct ConfigResponse {
    pub owner: Addr,
    pub cl8y_token: Addr,
    pub usdt_token: Addr,
    pub destination: Addr,
    pub price: Uint128,
}

#[cw_serde]
pub struct SimulateSwapResponse {
    pub cl8y_out: Uint128,
}

#[cw_serde]
pub struct MigrateMsg {
    /// CL8Y bridged USDT CW20 (18 decimals).
    pub usdt_token: String,
    /// USDT base units per whole CL8Y. When omitted, the stored 6-decimal
    /// Noble USDC price is multiplied by 10^12.
    pub price: Option<Uint128>,
}
