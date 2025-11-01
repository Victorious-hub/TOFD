use anchor_lang::prelude::*;

declare_id!("AFtX4cexdbori9CehN6sZH8Q9iRGfBBKnGNjNDzANyJM");

#[program]
pub mod counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.authority.key();
        counter.count = 0;
        Ok(())
    }

    pub fn increment(ctx: Context<ModifyCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(CounterError::CounterOverflow)?;
        Ok(())
    }

    pub fn decrement(ctx: Context<ModifyCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_sub(1)
            .ok_or(CounterError::CounterUnderflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = CounterAccount::SPACE)]
    pub counter: Account<'info, CounterAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyCounter<'info> {
    #[account(mut, has_one = authority)]
    pub counter: Account<'info, CounterAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct CounterAccount {
    pub authority: Pubkey,
    pub count: i64,
}

impl CounterAccount {
    pub const LEN: usize = 32 + 8;
    pub const SPACE: usize = 8 + Self::LEN; // Anchor discriminator + fields
}

#[error_code]
pub enum CounterError {
    #[msg("Counter overflowed the i64 range")]
    CounterOverflow,
    #[msg("Counter underflowed the i64 range")]
    CounterUnderflow,
}
