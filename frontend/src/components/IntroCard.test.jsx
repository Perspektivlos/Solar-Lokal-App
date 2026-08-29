import { render, screen, fireEvent } from "@testing-library/react";
import IntroCard from "./IntroCard";

describe("IntroCard", () => {
  const mockSections = [
    { label: "Section 1", body: "Description 1" },
    { label: "Section 2", body: "Description 2" },
  ];

  it("renders collapsed by default with proper ARIA attributes", () => {
    render(
      <IntroCard
        title="Dashboard"
        subtitle="Übersicht aller Live-Daten"
        sections={mockSections}
        testid="intro-dashboard"
      />
    );

    const toggleBtn = screen.getByTestId("intro-dashboard-toggle");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(toggleBtn.getAttribute("aria-controls")).toBe("intro-card-content-intro-dashboard");
    expect(toggleBtn.getAttribute("aria-label")).toBe("Dashboard Details anzeigen");

    expect(screen.queryByText("Section 1")).toBeNull();
  });

  it("expands on click and updates ARIA attributes and content visibility", () => {
    render(
      <IntroCard
        title="Dashboard"
        subtitle="Übersicht aller Live-Daten"
        sections={mockSections}
        testid="intro-dashboard"
      />
    );

    const toggleBtn = screen.getByTestId("intro-dashboard-toggle");
    fireEvent.click(toggleBtn);

    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    expect(toggleBtn.getAttribute("aria-label")).toBe("Dashboard Details schließen");

    expect(screen.getByText("Section 1")).toBeDefined();
    expect(screen.getByText("Description 1")).toBeDefined();

    const contentDiv = document.getElementById("intro-card-content-intro-dashboard");
    expect(contentDiv).not.toBeNull();
  });
});
