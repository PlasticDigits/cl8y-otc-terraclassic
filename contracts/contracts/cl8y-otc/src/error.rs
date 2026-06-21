use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("No funds sent")]
    NoFunds {},

    #[error("Invalid funds: expected exactly one coin of {expected}")]
    InvalidFunds { expected: String },

    #[error("Insufficient CL8Y in contract")]
    InsufficientCl8y {},

    #[error("Invalid price: must be greater than zero")]
    InvalidPrice {},

    #[error("Amount overflow")]
    Overflow {},
}
