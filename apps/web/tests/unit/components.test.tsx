import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SentimentBadge, SeverityMeter, Stars, TrendBadge } from "@/components/shared/badges"
import { DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { ApiError } from "@/lib/api"
import { formatCurrency, initials, titleCase } from "@/lib/utils"

describe("badges", () => {
  it("renders sentiment labels", () => {
    render(<SentimentBadge sentiment="negative" />)
    expect(screen.getByText("Negative")).toBeInTheDocument()
  })

  it("shows Pending for unanalyzed reviews", () => {
    render(<SentimentBadge sentiment={null} />)
    expect(screen.getByText("Pending")).toBeInTheDocument()
  })

  it("colors rising complaints red but rising praise green", () => {
    const { rerender } = render(<TrendBadge trend="rising" />)
    expect(screen.getByText("Rising").className).toContain("rose")
    rerender(<TrendBadge trend="rising" positive />)
    expect(screen.getByText("Rising").className).toContain("emerald")
  })

  it("clamps severity and exposes an accessible label", () => {
    render(<SeverityMeter value={140} />)
    expect(screen.getByLabelText("Severity 100 of 100")).toBeInTheDocument()
  })

  it("describes star ratings for screen readers", () => {
    render(<Stars rating={3} />)
    expect(screen.getByLabelText("3 out of 5 stars")).toBeInTheDocument()
  })
})

describe("states", () => {
  it("renders empty state with CTA", () => {
    render(<EmptyState title="No reviews analyzed yet" action={<button>Upload your first review dataset</button>} />)
    expect(screen.getByText("No reviews analyzed yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upload your first review dataset" })).toBeInTheDocument()
  })

  it("renders an upgrade prompt for plan-restricted errors", () => {
    render(<ErrorState error={new ApiError(402, "feature_not_in_plan", "Monitoring is not included in the Free plan.")} />)
    expect(screen.getByText("Upgrade to unlock this")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View plans" })).toHaveAttribute("href", "/app/billing")
  })

  it("renders permission denied for 403", () => {
    render(<ErrorState error={new ApiError(403, "insufficient_role", "Requires analyst role.")} />)
    expect(screen.getByText("You don't have access")).toBeInTheDocument()
  })

  it("labels demo data", () => {
    render(<DemoBadge />)
    expect(screen.getByTitle(/Synthetic sample data/)).toHaveTextContent("Demo")
  })
})

describe("utils", () => {
  it("formats currency from cents", () => {
    expect(formatCurrency(2900)).toBe("$29")
    expect(formatCurrency(null)).toBe("Custom")
  })
  it("builds initials and titles", () => {
    expect(initials("Aisha Khan")).toBe("AK")
    expect(titleCase("meeting_booked")).toBe("Meeting Booked")
  })
})
