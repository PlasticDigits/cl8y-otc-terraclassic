use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("USDT amount must be greater than zero")]
    NoFunds {},

    #[error("Native funds are not accepted")]
    UnexpectedFunds {},

    #[error("Invalid CW20 hook message")]
    InvalidHook {},

    #[error("USDT and CL8Y must be different tokens")]
    InvalidTokenConfig {},

    #[error("Contract is already migrated to USDT")]
    AlreadyMigrated {},

    #[error("Unsupported migration from version {version}")]
    UnsupportedVersion { version: String },

    #[error("Legacy payment denom is not Noble USDC")]
    UnexpectedLegacyDenom {},

    #[error("Insufficient CL8Y in contract")]
    InsufficientCl8y {},

    #[error("Invalid price: must be greater than zero")]
    InvalidPrice {},

    #[error("Amount overflow")]
    Overflow {},
}
