/**
 * The three accounts a loan payment touches, named to match servers/cash-book.
 *
 * `cash` is that server's own `CASH` id, character for character, so a line journalled
 * here lands in the same account its ledger already posts every payment and receipt to.
 * `loan_liability` and `interest_expense` are new: servers/cash-book derives no loan
 * entries yet, and it holds no account for either. They follow its convention exactly --
 * a snake_case id and a sentence-case name, the pair its `accountFor` returns -- so that
 * when it does derive them, these are the ids it will use and no journal produced here
 * has to be re-mapped.
 */
export const CASH = "cash";
export const LOAN_LIABILITY = "loan_liability";
export const INTEREST_EXPENSE = "interest_expense";

export const ACCOUNT_NAMES: Record<string, string> = {
  [CASH]: "Cash",
  [LOAN_LIABILITY]: "Loan liability",
  [INTEREST_EXPENSE]: "Interest expense",
};

export function accountName(id: string): string { return ACCOUNT_NAMES[id] ?? id; }
