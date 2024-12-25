import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { randomBytes } from "crypto";
import {
  createMint,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { expect } from "chai";
// Configure the client to use the local cluster.
anchor.setProvider(anchor.AnchorProvider.env());

const provider = <anchor.AnchorProvider>anchor.getProvider();
const program = anchor.workspace.Escrow as Program<Escrow>;
const connection = provider.connection;

const maker = provider.wallet as anchor.Wallet;
const taker = anchor.web3.Keypair.generate();

let seed: anchor.BN;
let mintA: anchor.web3.PublicKey;
let mintB: anchor.web3.PublicKey;
let escrow: anchor.web3.PublicKey;
let vault: anchor.web3.PublicKey;
let makerAtaA: anchor.web3.PublicKey;

const receiveAmount = 50_000_000;
const deposit = 10_000_000;
const initialMakerAtaABalance = 100_000_000;
const initialTakerAtaBBalance = 100_000_000;

async function commonSetup() {
  seed = new anchor.BN(Math.floor(Math.random() * 1000_000_000));

  //   Create Mints
  mintA = await createMint(connection, maker.payer, maker.publicKey, null, 6);
  mintB = await createMint(connection, maker.payer, maker.publicKey, null, 6);

  //   Derive escrow address
  escrow = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.publicKey.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  //   Derive vault address
  vault = await getAssociatedTokenAddress(mintA, escrow, true);

  makerAtaA = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      maker.payer,
      mintA,
      maker.publicKey
    )
  ).address;

  await mintTo(
    connection,
    maker.payer,
    mintA,
    makerAtaA,
    maker.payer,
    initialMakerAtaABalance
  );

  await connection.requestAirdrop(
    taker.publicKey,
    1 * anchor.web3.LAMPORTS_PER_SOL
  );
}

describe("Make and Refund", () => {
  before(async () => {
    await commonSetup();
  });

  it("Init escrow and deposit", async () => {
    const tx = await program.methods
      .make(seed, new anchor.BN(deposit), new anchor.BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA,
        mintB,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker.payer])
      .rpc();
    console.log("Your transaction signature: ", tx);

    const vaultBalance = Number(
      (await connection.getTokenAccountBalance(vault)).value.amount
    );

    const makerAtaBalance = Number(
      (await connection.getTokenAccountBalance(makerAtaA)).value.amount
    );
    expect(vaultBalance).to.equal(deposit);
    expect(makerAtaBalance).to.equal(initialMakerAtaABalance - deposit);
  });

  it("Refunds", async () => {
    const tx = await program.methods
      .refund()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        escrow,
      })
      .signers([maker.payer])
      .rpc();

    try {
      await connection.getTokenAccountBalance(vault);
    } catch (err) {
      expect(err.toString()).to.include("could not find account");
    }

    const makerAtaBalanceA = Number(
      (await connection.getTokenAccountBalance(makerAtaA)).value.amount
    );
    expect(makerAtaBalanceA).to.equal(initialMakerAtaABalance);
  });
});

describe("Make and Take", () => {
  let takerAtaB: anchor.web3.PublicKey;

  before(async () => {
    await commonSetup();
    takerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        maker.payer,
        mintB,
        taker.publicKey
      )
    ).address;

    await mintTo(
      connection,
      maker.payer,
      mintB,
      takerAtaB,
      maker.payer,
      initialTakerAtaBBalance
    );
  });

  it("Init escrow and deposit", async () => {
    const tx = await program.methods
      .make(seed, new anchor.BN(deposit), new anchor.BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA,
        mintB,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker.payer])
      .rpc();
    console.log("Your transaction signature: ", tx);

    const vaultBalance = Number(
      (await connection.getTokenAccountBalance(vault)).value.amount
    );

    const makerAtaBalance = Number(
      (await connection.getTokenAccountBalance(makerAtaA)).value.amount
    );
    expect(vaultBalance).to.equal(deposit);
    expect(makerAtaBalance).to.equal(initialMakerAtaABalance - deposit);
  });

  it("Take and Close Vault", async () => {
    await program.methods
      .take()
      .accounts({ taker: taker.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        mintB,
        escrow,
      })
      .signers([taker])
      .rpc();

    const makerAtaB = getAssociatedTokenAddressSync(mintB, maker.publicKey);
    const makerAtaBBalance = Number(
      (await connection.getTokenAccountBalance(makerAtaB)).value.amount
    );
    const takerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
    const takerAtaABalance = Number(
      (await connection.getTokenAccountBalance(takerAtaA)).value.amount
    );
    const takerAtaBBalance = Number(
      (await connection.getTokenAccountBalance(takerAtaB)).value.amount
    );
    expect(makerAtaBBalance).to.equal(receiveAmount);
    expect(takerAtaABalance).to.equal(deposit);
    expect(takerAtaBBalance).to.equal(initialTakerAtaBBalance - receiveAmount);
  });
});
