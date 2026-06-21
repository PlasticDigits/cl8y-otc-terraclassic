use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Uint128};

#[cw_serde]
pub struct InstantiateMsg {
    pub owner: String,
    pub cl8y_token: String,
    pub usdc_denom: String,
    pub destination: String,
    /// Micro-USDC per 1 whole CL8Y. Defaults to 700_000 (0.70 USDC).
    pub price: Option<Uint128>,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Swap native USDC for CL8Y at the current rate.
    Swap {},
    /// Owner: update CL8Y price in micro-USDC per whole token.
    UpdateRate { price: Uint128 },
    /// Owner: update USDC destination address.
    UpdateDestination { destination: String },
    /// Owner: withdraw CL8Y from contract inventory.
    WithdrawCl8y { amount: Uint128 },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},
    #[returns(Uint128)]
    TotalUsdcSpent {},
    #[returns(SimulateSwapResponse)]
    SimulateSwap { usdc_in: Uint128 },
}

#[cw_serde]
pub struct ConfigResponse {
    pub owner: Addr,
    pub cl8y_token: Addr,
    pub usdc_denom: String,
    pub destination: Addr,
    pub price: Uint128,
}

#[cw_serde]
pub struct SimulateSwapResponse {
    pub cl8y_out: Uint128,
}
