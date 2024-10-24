use anchor_lang::prelude::*;

declare_id!("CDaQdxv38pU9X1siTfMgiztVPSu95KYCAEepfwhhTVjD");

mod state;
mod instructions;

use instructions::*;

#[program]
pub mod escrow_program {
    use super::*;
}

