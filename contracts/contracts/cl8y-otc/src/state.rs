use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::Item;

pub const CONTRACT_NAME: &str = "cl8y-otc";
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Micro-USDC per 1 whole CL8Y (18 decimals). Default 0.70 USDC = 700_000.
pub const DEFAULT_PRICE: u128 = 700_000;

/// 10^18 — one whole CL8Y in base units.
pub const CL8Y_UNIT: u128 = 1_000_000_000_000_000_000;

#[cw_serde]
pub struct Config {
    pub owner: Addr,
    pub cl8y_token: Addr,
    pub usdc_denom: String,
    pub destination: Addr,
    pub price: Uint128,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const TOTAL_USDC_SPENT: Item<Uint128> = Item::new("total_usdc_spent");
