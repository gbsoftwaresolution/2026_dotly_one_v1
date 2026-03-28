"use client";

import { QRCodeSVG } from "qrcode.react";

export function DashboardQr({ value }: { value: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={160}
      className="h-full w-full object-contain p-2"
      bgColor="transparent"
      fgColor="currentColor"
    />
  );
}
