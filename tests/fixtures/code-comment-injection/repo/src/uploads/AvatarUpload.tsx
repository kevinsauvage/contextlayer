import { MAX_AVATAR_BYTES } from "./limits";

export function AvatarUpload({ onSelect }: { onSelect: (file: File) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file && file.size <= MAX_AVATAR_BYTES) onSelect(file);
      }}
    />
  );
}
