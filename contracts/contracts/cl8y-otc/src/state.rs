use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::Item;

pub const CONTRACT_NAME: &str = "cl8y-otc";
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// USDT base units (18 decimals) per 1 whole CL8Y. Default 0.70 USDT.
pub const DEFAULT_PRICE: u128 = 700_000_000_000_000_000;

/// 10^18 — one whole CL8Y, and one whole USDT, in base units.
pub const CL8Y_UNIT: u128 = 1_000_000_000_000_000_000;

/// Noble USDC (6 decimals) → CL8Y USDT (18 decimals). Legacy prices are multiplied by this.
pub const LEGACY_PRICE_SCALE: u128 = 1_000_000_000_000;

/// Noble USDC on Terra Classic via IBC channel-149. Required for migration from v0.1.0.
pub const NOBLE_USDC_DENOM: &str =
    "ibc/0BB9D8513E8E8E9AE6A9D211D9136E6DA42288DDE6CFAA453A150A4566054DC5";

/// v0.1.0 config. Same storage key as [`CONFIG`]; only read during migration.
#[cw_serde]
pub struct LegacyConfig {
    pub owner: Addr,
    pub cl8y_token: Addr,
    pub usdc_denom: String,
    pub destination: Addr,
    pub price: Uint128,
}

#[cw_serde]
pub struct Config {
    pub owner: Addr,
    pub cl8y_token: Addr,
    pub usdt_token: Addr,
    pub destination: Addr,
    pub price: Uint128,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const LEGACY_CONFIG: Item<LegacyConfig> = Item::new("config");
pub const TOTAL_USDT_SPENT: Item<Uint128> = Item::new("total_usdt_spent");
pub const TOTAL_USDC_SPENT: Item<Uint128> = Item::new("total_usdc_spent");
