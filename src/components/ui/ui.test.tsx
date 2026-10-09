import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Field, Input } from "./Field";
import { Progress } from "./Progress";
import { ErrorState } from "./States";
import { Avatar } from "./Avatar";

describe("ui primitives", () => {
  it("Button shows a busy state and blocks clicks while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
  it("Field links label and control and announces errors", () => {
    render(<Field label="Email" error="Enter a valid email">{(id, d) => <Input id={id} aria-describedby={d} invalid />}</Field>);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
  it("Progress clamps values and exposes ARIA", () => {
    render(<Progress value={150} label="Done" />);
    expect(screen.getByRole("progressbar", { name: "Done" })).toHaveAttribute("aria-valuenow", "100");
  });
  it("ErrorState shows a safe message, never raw error text, and offers retry", async () => {
    const retry = vi.fn();
    render(<ErrorState error={new Error('relation "secrets" does not exist')} onRetry={retry} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/secrets/);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("Avatar is labelled with the person's name", () => {
    render(<Avatar name="Alice Carter" />);
    expect(screen.getByRole("img", { name: "Alice Carter" })).toHaveTextContent("AC");
  });
});
