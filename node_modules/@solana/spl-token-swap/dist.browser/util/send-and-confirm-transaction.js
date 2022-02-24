import { sendAndConfirmTransaction as realSendAndConfirmTransaction } from '@solana/web3.js';
export function sendAndConfirmTransaction(title, connection, transaction) {
    var signers = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        signers[_i - 3] = arguments[_i];
    }
    return realSendAndConfirmTransaction(connection, transaction, signers, {
        skipPreflight: false,
        commitment: 'recent',
        preflightCommitment: 'recent',
    });
}
