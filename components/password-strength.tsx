"use client";

export type PasswordRules = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  special: boolean;
};

export function checkPassword(password: string): PasswordRules {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const r = checkPassword(password);
  return r.length && r.uppercase && r.lowercase && r.special;
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Uppercase letter (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a–z)", met: /[a-z]/.test(password) },
    { label: "Special character (!@#$…)", met: /[^a-zA-Z0-9]/.test(password) },
  ];

  return (
    <ul className="mt-2 space-y-1">
      {rules.map((rule) => (
        <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors ${rule.met ? "text-green-600" : "text-gray-400"}`}>
          <span className="text-base leading-none">{rule.met ? "✓" : "○"}</span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
