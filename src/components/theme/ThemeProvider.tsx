import React from "react";

type ThemeProviderProps = {
  primaryColor: string;
  logoUrl?: string | null;
  brandName: string;
  children: React.ReactNode;
};

export function ThemeProvider({ primaryColor, logoUrl, brandName, children }: ThemeProviderProps) {
  return (
    <div
      style={{ "--brand-primary": primaryColor } as React.CSSProperties}
      data-brand-name={brandName}
      data-brand-logo={logoUrl ?? ""}
      className="min-h-full"
    >
      {children}
    </div>
  );
}
