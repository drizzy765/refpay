// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MemoProxy (RefPay FALLBACK ONLY)
/// @notice Deploy this ONLY if PayBox's validator rejects the primary strategy
///         (ERC-20 transfer calldata with an appended reference). See ARCHITECTURE.md §7.
/// @dev    Requires the payer to first approve this contract for `amount` of `token`.
///         PayBox V1 accepts one transaction per proposal, so the flow is TWO proposals:
///         (1) USDC.approve(MemoProxy, amount)  -> wait for confirmation
///         (2) MemoProxy.payWithMemo(USDC, payee, amount, memo)
///         Holds no funds, no owner, no upgradeability.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MemoProxy {
    event PaymentMemo(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 amount,
        string memo
    );

    error EmptyMemo();
    error MemoTooLong();
    error TransferFailed();

    function payWithMemo(address token, address payee, uint256 amount, string calldata memo) external {
        uint256 len = bytes(memo).length;
        if (len == 0) revert EmptyMemo();
        if (len > 64) revert MemoTooLong();
        if (!IERC20(token).transferFrom(msg.sender, payee, amount)) revert TransferFailed();
        emit PaymentMemo(msg.sender, payee, token, amount, memo);
    }
}
