import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
    },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
  });

  it("disables inputs and explains setup when Supabase is not configured", () => {
    render(
      <LoginForm isConfigured={false} nextPath="/admin" setupRequired={true} />,
    );

    expect(screen.getByLabelText(/^email$/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    expect(screen.getByText(/supabase env vars are not configured/i)).toBeInTheDocument();
  });

  it("submits credentials and navigates to the requested path", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });

    render(
      <LoginForm isConfigured={true} nextPath="/admin/clients" setupRequired={false} />,
    );

    await user.type(screen.getByLabelText(/^email$/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct horse battery staple",
    });
    expect(push).toHaveBeenCalledWith("/admin/clients");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows Supabase sign-in errors without navigating", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    render(
      <LoginForm isConfigured={true} nextPath="/admin" setupRequired={false} />,
    );

    await user.type(screen.getByLabelText(/^email$/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
