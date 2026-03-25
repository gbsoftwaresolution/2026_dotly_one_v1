import React from "react";

interface LoadingProps {
  message?: string;
  size?: "small" | "medium" | "large";
  color?: string;
  textColor?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message = "Loading...",
  size = "medium",
  color = "#007bff",
  textColor = "#6c757d",
}) => {
  const sizePx = size === "small" ? "20px" : size === "large" ? "60px" : "40px";
  const borderWidth = size === "small" ? "2px" : "3px";
  const fontSize = size === "small" ? "0.8rem" : "1rem";
  const padding = size === "small" ? "0.5rem" : "3rem";
  const minHeight = size === "small" ? "auto" : "200px";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: padding,
        minHeight: minHeight,
      }}
    >
      <div
        style={{
          width: sizePx,
          height: sizePx,
          border: `${borderWidth} solid rgba(255,255,255,0.2)`,
          borderTop: `${borderWidth} solid ${color}`,
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: message ? "0.5rem" : 0,
        }}
      />
      {message && (
        <p style={{ color: textColor, fontSize, margin: 0 }}>{message}</p>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
