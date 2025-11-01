use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::token::spl_token;

pub const DEX_STATE_SEED: &[u8] = b"dex-state";
pub const RATE_LAMPORTS_PER_TOKEN: u64 = 500_000_000; // 0.5 SOL assuming 9 decimals for SOL

declare_id!("c37jV6isXMfR88okiAnRUcsMn5nD7HGLmcSEkq5zVJT");

#[program]
pub mod dex {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        token_liquidity: u64,
        wsol_liquidity: u64,
    ) -> Result<()> {
        require!(token_liquidity > 0 && wsol_liquidity > 0, DexError::InvalidLiquidity);

        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.payer.key();
        state.mint = ctx.accounts.mint.key();
        state.wsol_mint = ctx.accounts.wsol_mint.key();
        state.token_vault = ctx.accounts.token_vault.key();
        state.wsol_vault = ctx.accounts.wsol_vault.key();
        state.bump = ctx.bumps.state;
        let mint_decimals = ctx.accounts.mint.decimals;
        10_u128
            .checked_pow(mint_decimals as u32)
            .ok_or(DexError::UnsupportedDecimals)?;
        state.mint_decimals = mint_decimals;
        state.rate_lamports_per_token = RATE_LAMPORTS_PER_TOKEN;

        // Move initial liquidity into the vaults.
        token::transfer(ctx.accounts.token_to_vault_context(), token_liquidity)?;

        token::transfer(ctx.accounts.wsol_to_vault_context(), wsol_liquidity)?;

        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, wsol_amount: u64) -> Result<()> {
        require!(wsol_amount > 0, DexError::InvalidAmount);

        let state = &ctx.accounts.state;
        let token_amount = state
            .lamports_to_tokens(wsol_amount)
            .ok_or(DexError::AmountTooSmall)?;
        require!(token_amount > 0, DexError::AmountTooSmall);

        require!(
            ctx.accounts.token_vault.amount >= token_amount,
            DexError::InsufficientLiquidity
        );

        // Buyer sends WSOL into vault.
        token::transfer(ctx.accounts.wsol_from_buyer_context(), wsol_amount)?;

        // Vault sends tokens to buyer with PDA authority.
        let bump = [state.bump];
        let signer_seeds: &[&[u8]] = &[DEX_STATE_SEED, state.mint.as_ref(), &bump];
        token::transfer(
            ctx.accounts
                .tokens_to_buyer_context()
                .with_signer(&[signer_seeds]),
            token_amount,
        )?;

        Ok(())
    }

    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        require!(token_amount > 0, DexError::InvalidAmount);

        let state = &ctx.accounts.state;
        let lamports_amount = state
            .tokens_to_lamports(token_amount)
            .ok_or(DexError::AmountTooSmall)?;
        require!(lamports_amount > 0, DexError::AmountTooSmall);

        require!(
            ctx.accounts.wsol_vault.amount >= lamports_amount,
            DexError::InsufficientLiquidity
        );

        // Seller sends tokens into vault.
        token::transfer(ctx.accounts.tokens_from_seller_context(), token_amount)?;

        // Vault sends WSOL back to seller.
        let bump = [state.bump];
        let signer_seeds: &[&[u8]] = &[DEX_STATE_SEED, state.mint.as_ref(), &bump];
        token::transfer(
            ctx.accounts
                .wsol_to_seller_context()
                .with_signer(&[signer_seeds]),
            lamports_amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(address = spl_token::native_mint::ID)]
    pub wsol_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        seeds = [DEX_STATE_SEED, mint.key().as_ref()],
        bump,
        payer = payer,
        space = DexState::SPACE,
    )]
    pub state: Account<'info, DexState>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = state,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = wsol_mint,
        associated_token::authority = state,
    )]
    pub wsol_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = payer_token_ata.owner == payer.key(), constraint = payer_token_ata.mint == mint.key())]
    pub payer_token_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = payer_wsol_ata.owner == payer.key(), constraint = payer_wsol_ata.mint == wsol_mint.key())]
    pub payer_wsol_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(address = spl_token::native_mint::ID)]
    pub wsol_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [DEX_STATE_SEED, mint.key().as_ref()],
        bump = state.bump,
    )]
    pub state: Account<'info, DexState>,
    #[account(mut, constraint = buyer_token_ata.owner == buyer.key(), constraint = buyer_token_ata.mint == mint.key())]
    pub buyer_token_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = buyer_wsol_ata.owner == buyer.key(), constraint = buyer_wsol_ata.mint == wsol_mint.key())]
    pub buyer_wsol_ata: Account<'info, TokenAccount>,
    #[account(mut, address = state.token_vault)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut, address = state.wsol_vault)]
    pub wsol_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(address = spl_token::native_mint::ID)]
    pub wsol_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [DEX_STATE_SEED, mint.key().as_ref()],
        bump = state.bump,
    )]
    pub state: Account<'info, DexState>,
    #[account(mut, constraint = seller_token_ata.owner == seller.key(), constraint = seller_token_ata.mint == mint.key())]
    pub seller_token_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = seller_wsol_ata.owner == seller.key(), constraint = seller_wsol_ata.mint == wsol_mint.key())]
    pub seller_wsol_ata: Account<'info, TokenAccount>,
    #[account(mut, address = state.token_vault)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut, address = state.wsol_vault)]
    pub wsol_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Initialize<'info> {
    fn token_to_vault_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.payer_token_ata.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }

    fn wsol_to_vault_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.payer_wsol_ata.to_account_info(),
            to: self.wsol_vault.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}

impl<'info> Buy<'info> {
    fn wsol_from_buyer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.buyer_wsol_ata.to_account_info(),
            to: self.wsol_vault.to_account_info(),
            authority: self.buyer.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }

    fn tokens_to_buyer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.token_vault.to_account_info(),
            to: self.buyer_token_ata.to_account_info(),
            authority: self.state.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}

impl<'info> Sell<'info> {
    fn tokens_from_seller_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.seller_token_ata.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.seller.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }

    fn wsol_to_seller_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.wsol_vault.to_account_info(),
            to: self.seller_wsol_ata.to_account_info(),
            authority: self.state.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}

#[account]
pub struct DexState {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub wsol_mint: Pubkey,
    pub token_vault: Pubkey,
    pub wsol_vault: Pubkey,
    pub rate_lamports_per_token: u64,
    pub mint_decimals: u8,
    pub bump: u8,
    pub _padding: [u8; 6],
}

impl DexState {
    pub const SPACE: usize = 8 + (32 * 5) + 8 + 1 + 1 + 6; // discriminator + fields

    fn decimals_factor(&self) -> Option<u128> {
        10_u128.checked_pow(self.mint_decimals as u32)
    }

    pub fn lamports_to_tokens(&self, lamports: u64) -> Option<u64> {
        let factor = self.decimals_factor()?;
        let numerator = (lamports as u128).checked_mul(factor)?;
        let tokens_raw = numerator.checked_div(self.rate_lamports_per_token as u128)?;
        u64::try_from(tokens_raw).ok()
    }

    pub fn tokens_to_lamports(&self, tokens_raw: u64) -> Option<u64> {
        let factor = self.decimals_factor()?;
        let numerator = (tokens_raw as u128).checked_mul(self.rate_lamports_per_token as u128)?;
        let lamports = numerator.checked_div(factor)?;
        u64::try_from(lamports).ok()
    }

    // signer seeds constructed on demand within instructions to avoid lifetime issues.
}

#[error_code]
pub enum DexError {
    #[msg("Liquidity amounts must be greater than zero")]
    InvalidLiquidity,
    #[msg("Supplied amount must be greater than zero")]
    InvalidAmount,
    #[msg("Calculated amount rounds down to zero")]
    AmountTooSmall,
    #[msg("Vault does not have enough liquidity")]
    InsufficientLiquidity,
    #[msg("Internal math overflow or missing seeds")]
    MathOverflow,
    #[msg("Mint decimals exceed supported range")]
    UnsupportedDecimals,
}
