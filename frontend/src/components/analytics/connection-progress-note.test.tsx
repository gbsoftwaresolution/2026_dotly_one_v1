import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionProgressNote } from "./connection-progress-note";

describe("ConnectionProgressNote", () => {
  it("shows a subtle momentum line when the user has connections", () => {
    render(
      React.createElement(ConnectionProgressNote, {
        analytics: {
          totalConnections: 24,
          connectionsThisMonth: 5,
        },
      }),
    );

    expect(screen.getByText(/you've connected with/i)).toBeInTheDocument();
    expect(screen.getByText(/24 people/i)).toBeInTheDocument();
    expect(screen.getByText(/\+5 this month/i)).toBeInTheDocument();
  });

  it("switches to a motivational empty state before the first connection", () => {
    render(
      React.createElement(ConnectionProgressNote, {
        analytics: {
          totalConnections: 0,
          connectionsThisMonth: 0,
        },
      }),
    );

    expect(
      screen.getByText(/your next scan could become your first connection/i),
    ).toBeInTheDocument();
  });
});
