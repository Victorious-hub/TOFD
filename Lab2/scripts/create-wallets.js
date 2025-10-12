"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var bs58_1 = require("bs58");
var fs_1 = require("fs");
var path_1 = require("path");
var endpoint = (_a = process.env.SOLANA_RPC) !== null && _a !== void 0 ? _a : "https://api.devnet.solana.com";
var commitment = ((_b = process.env.SOLANA_COMMITMENT) !== null && _b !== void 0 ? _b : "confirmed");
function requireEnv(name) {
    var value = process.env[name];
    if (!value) {
        throw new Error("Missing required environment variable ".concat(name));
    }
    return value;
}
function loadPayer() {
    var _a;
    if (process.env.PAYER_SECRET) {
        return web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.PAYER_SECRET));
    }
    var path = (_a = process.env.PAYER_KEYPAIR_PATH) !== null && _a !== void 0 ? _a : "../../Lab2/wallet.json";
    var resolved = (0, path_1.resolve)(process.cwd(), path);
    var secret = (0, fs_1.readFileSync)(resolved, "utf-8").trim();
    return web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(secret));
}
function parseMint() {
    return new web3_js_1.PublicKey(requireEnv("TOKEN_MINT_ADDRESS"));
}
function parseDecimals() {
    var _a;
    var raw = (_a = process.env.TOKEN_DECIMALS) !== null && _a !== void 0 ? _a : "9";
    var parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
        throw new Error("Invalid TOKEN_DECIMALS value: ".concat(raw));
    }
    return parsed;
}
function parseCount() {
    var _a, _b;
    var raw = (_b = (_a = process.argv[2]) !== null && _a !== void 0 ? _a : process.env.NEW_WALLET_COUNT) !== null && _b !== void 0 ? _b : "3";
    var parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid wallet count: ".concat(raw));
    }
    return parsed;
}
function parseTokenAmount(decimals) {
    var _a;
    var raw = (_a = process.env.NEW_WALLET_TOKEN_AMOUNT) !== null && _a !== void 0 ? _a : "10";
    var _b = raw.split("."), whole = _b[0], _c = _b[1], fraction = _c === void 0 ? "" : _c;
    if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
        throw new Error("Invalid token amount format: ".concat(raw));
    }
    if (fraction.length > decimals) {
        throw new Error("Token amount ".concat(raw, " has more fractional digits than mint decimals (").concat(decimals, ")"));
    }
    var paddedFraction = fraction.padEnd(decimals, "0");
    var amountStr = "".concat(whole).concat(paddedFraction).replace(/^0+/, "");
    return amountStr === "" ? 0n : BigInt(amountStr);
}
function parseAirdrop() {
    var _a;
    var raw = (_a = process.env.NEW_WALLET_AIRDROP_SOL) !== null && _a !== void 0 ? _a : "0.5";
    var value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error("Invalid NEW_WALLET_AIRDROP_SOL value: ".concat(raw));
    }
    return Math.round(value * web3_js_1.LAMPORTS_PER_SOL);
}
function ensureAta(connection, payer, mint, owner) {
    return __awaiter(this, void 0, void 0, function () {
        var ata, error_1, tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(mint, owner)];
                case 1:
                    ata = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, spl_token_1.getAccount)(connection, ata, commitment)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, ata];
                case 4:
                    error_1 = _a.sent();
                    tx = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(payer.publicKey, ata, owner, mint));
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [payer], { commitment: commitment })];
                case 5:
                    _a.sent();
                    return [2 /*return*/, ata];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function requestAirdrop(connection, recipient, lamports) {
    return __awaiter(this, void 0, void 0, function () {
        var signature, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (lamports <= 0) {
                        return [2 /*return*/, false];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, connection.requestAirdrop(recipient, lamports)];
                case 2:
                    signature = _a.sent();
                    return [4 /*yield*/, connection.confirmTransaction(signature, commitment)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    error_2 = _a.sent();
                    console.warn("\u26A0\uFE0F  Airdrop of ".concat(lamports / web3_js_1.LAMPORTS_PER_SOL, " SOL to ").concat(recipient.toBase58(), " failed. Fund manually and rerun if needed."));
                    console.warn("   →", error_2);
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function transferTokens(connection, payer, mint, sourceAta, destinationAta, amount, decimals) {
    return __awaiter(this, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (amount <= 0n) {
                        return [2 /*return*/];
                    }
                    tx = new web3_js_1.Transaction().add((0, spl_token_1.createTransferCheckedInstruction)(sourceAta, mint, destinationAta, payer.publicKey, Number(amount), decimals, [], spl_token_1.TOKEN_PROGRAM_ID));
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [payer], { commitment: commitment })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, payer, mint, decimals, count, tokenAmount, airdropLamports, payerAta, createdWallets, i, wallet, funded, walletAta, outputPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connection = new web3_js_1.Connection(endpoint, commitment);
                    payer = loadPayer();
                    mint = parseMint();
                    decimals = parseDecimals();
                    count = parseCount();
                    tokenAmount = parseTokenAmount(decimals);
                    airdropLamports = parseAirdrop();
                    return [4 /*yield*/, ensureAta(connection, payer, mint, payer.publicKey)];
                case 1:
                    payerAta = _a.sent();
                    createdWallets = [];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < count)) return [3 /*break*/, 7];
                    wallet = web3_js_1.Keypair.generate();
                    console.log("Wallet #".concat(i + 1, ": ").concat(wallet.publicKey.toBase58()));
                    console.log("   Secret (base58): ".concat(bs58_1.default.encode(wallet.secretKey)));
                    return [4 /*yield*/, requestAirdrop(connection, wallet.publicKey, airdropLamports)];
                case 3:
                    funded = _a.sent();
                    if (!funded && airdropLamports > 0) {
                        console.warn("   Airdrop skipped; continue after funding manually if required.");
                    }
                    return [4 /*yield*/, ensureAta(connection, payer, mint, wallet.publicKey)];
                case 4:
                    walletAta = _a.sent();
                    return [4 /*yield*/, transferTokens(connection, payer, mint, payerAta, walletAta, tokenAmount, decimals)];
                case 5:
                    _a.sent();
                    createdWallets.push({
                        index: i + 1,
                        publicKey: wallet.publicKey.toBase58(),
                        secret: bs58_1.default.encode(wallet.secretKey),
                        tokenAccount: walletAta.toBase58(),
                        airdropped: funded,
                    });
                    console.log("Created wallet ".concat(wallet.publicKey.toBase58(), " with ATA ").concat(walletAta.toBase58()));
                    _a.label = 6;
                case 6:
                    i += 1;
                    return [3 /*break*/, 2];
                case 7:
                    outputPath = (0, path_1.resolve)(process.cwd(), "generated-wallets.json");
                    (0, fs_1.writeFileSync)(outputPath, JSON.stringify(createdWallets, null, 2), "utf-8");
                    console.log("Saved ".concat(createdWallets.length, " wallets to ").concat(outputPath));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Failed to create wallets:", error);
    process.exit(1);
});
