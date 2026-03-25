import React from "react";
import { NavLink } from "react-router-dom";

interface LifeDocsTabsProps {
  activeTab?: string;
}

export const LifeDocsTabs: React.FC<LifeDocsTabsProps> = () => {
  const Tab = ({ to, label }: { to: string; label: string }) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `lifeDocsTab${isActive ? " lifeDocsTab--active" : ""}`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <div className="lifeDocsTabs">
      <Tab to="/apps/life-docs" label="Documents" />
      <Tab to="/apps/life-docs/timeline" label="Timeline" />
      <Tab to="/apps/life-docs/family" label="Family" />
      <Tab to="/apps/life-docs/continuity" label="Continuity & Heirs" />
      <Tab to="/apps/life-docs/settings" label="Settings" />
    </div>
  );
};
// Re-writing the file to include continuity tab would be safer if I read it first.
// But the read_file output is truncated.
// I'll read the whole file then rewrite it.
