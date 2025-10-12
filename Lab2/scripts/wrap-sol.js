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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var bs58_1 = require("bs58");
function requireEnv(name) {
    var value = process.env[name];
    if (!value) {
        throw new Error("Missing required environment variable ".concat(name));
    }
    return value;
}
var endpoint = (_a = process.env.SOLANA_RPC) !== null && _a !== void 0 ? _a : "https://api.devnet.solana.com";
var commitment = ((_b = process.env.SOLANA_COMMITMENT) !== null && _b !== void 0 ? _b : "confirmed");
var payer = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(requireEnv("PAYER_SECRET")));
var owner = process.env.WRAP_SOL_OWNER
    ? new web3_js_1.PublicKey(process.env.WRAP_SOL_OWNER)
    : payer.publicKey;
var amountInput = (_c = process.env.WRAP_SOL_AMOUNT) !== null && _c !== void 0 ? _c : "0.5";
var amountFloat = Number.parseFloat(amountInput);
if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
    throw new Error("Invalid WRAP_SOL_AMOUNT value: ".concat(amountInput));
}
var lamports = Math.round(amountFloat * web3_js_1.LAMPORTS_PER_SOL);
if (!Number.isSafeInteger(lamports)) {
    throw new Error("Requested amount ".concat(amountFloat, " SOL is too large for a single transaction"));
}
function wrapSol() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, ata, instructions, ataInfo, tx, latestBlockhash, signature;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connection = new web3_js_1.Connection(endpoint, commitment);
                    return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(spl_token_1.NATIVE_MINT, owner, false)];
                case 1:
                    ata = _a.sent();
                    instructions = [];
                    return [4 /*yield*/, connection.getAccountInfo(ata)];
                case 2:
                    ataInfo = _a.sent();
                    if (!ataInfo) {
                        instructions.push((0, spl_token_1.createAssociatedTokenAccountInstruction)(payer.publicKey, ata, owner, spl_token_1.NATIVE_MINT));
                    }
                    instructions.push(web3_js_1.SystemProgram.transfer({
                        fromPubkey: payer.publicKey,
                        toPubkey: ata,
                        lamports: lamports,
                    }));
                    instructions.push((0, spl_token_1.createSyncNativeInstruction)(ata));
                    tx = new web3_js_1.Transaction();
                    tx.add.apply(tx, instructions);
                    tx.feePayer = payer.publicKey;
                    return [4 /*yield*/, connection.getLatestBlockhash(commitment)];
                case 3:
                    latestBlockhash = _a.sent();
                    tx.recentBlockhash = latestBlockhash.blockhash;
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [payer], {
                            commitment: commitment,
                        })];
                case 4:
                    signature = _a.sent();
                    console.log("Wrapped SOL signature:", signature);
                    console.log("WSOL Associated Token Address:", ata.toBase58());
                    return [2 /*return*/];
            }
        });
    });
}
wrapSol().catch(function (err) {
    console.error("Failed to wrap SOL:", err);
    process.exit(1);
});
