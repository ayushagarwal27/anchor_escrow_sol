### Escrow Program

A Solana program for holding funds until a condition is met for achieving a trustless conditional transfer.

#### Make Instruction

- Maker initializes escrow PDA,
- Maker creates vault PDA, whose authority lies with escrow
- Escrow contains information of token mint addresses and amount that needs to be exchanged

#### Refund Instruction

- Maker calls refund instruction for closing escrow and get a refund

#### Take Instruction

- Taker creates associated_token_account (ATA) for maker
- Taker transfers tokens to maker ATA
- Escrow transfers tokens from vault to taker ATA
- Escrow PDA is closed

Tech Stack : Anchor, Rust

- [Repo Link](https://github.com/ayushagarwal27/anchor_escrow_sol/tree/main)
