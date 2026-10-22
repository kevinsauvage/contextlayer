import { LockIcon } from "../icons";

export function PayButton({ onPay }: { onPay: () => void }) {
  return (
    <button className="pay" onClick={onPay}>
      <LockIcon />
    </button>
  );
}
