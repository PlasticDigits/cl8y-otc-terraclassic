export interface OtcConfig {
  owner: string;
  cl8y_token: string;
  usdc_denom: string;
  destination: string;
  price: string;
}

export interface SimulateSwapResponse {
  cl8y_out: string;
}

export interface Cw20Balance {
  balance: string;
}
