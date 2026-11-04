import { useState } from "react";
import { LogIn } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Feedback, FieldMessage, Spinner } from "../components/ui/feedback";
import { useFormValidation } from "../lib/use-form-validation";
import { useUserStore } from "../stores/user.store";
export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error } = useUserStore();
  const validation = useFormValidation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <img
            src="/brand/tempopress-logo.png"
            alt="Logo Tempopress"
            className="size-12 object-contain"
          />
          <div>
            <p className="text-sm font-bold">
              PT Tempopress International Delivery
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Technical Test</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold">Halaman Login</h1>
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (
              loading ||
              !validation.report({
                ...(!username.trim()
                  ? { "login-username": "Username wajib diisi." }
                  : {}),
                ...(!password
                  ? { "login-password": "Password wajib diisi." }
                  : {}),
              })
            )
              return;
            void login(username, password);
          }}
        >
          <div>
            <label
              htmlFor="login-username"
              className="mb-1.5 block text-sm font-medium"
            >
              Username
            </label>
            <Input
              id="login-username"
              type="text"
              autoComplete="username"
              maxLength={64}
              value={username}
              disabled={loading}
              {...validation.fieldProps("login-username")}
              onChange={(event) => {
                setUsername(event.target.value);
                validation.clear("login-username");
              }}
            />
            <FieldMessage
              id="login-username"
              message={validation.inlineMessage("login-username")}
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-medium"
            >
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              value={password}
              disabled={loading}
              {...validation.fieldProps("login-password")}
              onChange={(event) => {
                setPassword(event.target.value);
                validation.clear("login-password");
              }}
            />
            <FieldMessage
              id="login-password"
              message={validation.inlineMessage("login-password")}
            />
          </div>
          {validation.generalMessage && (
            <Feedback>{validation.generalMessage}</Feedback>
          )}
          {error && <Feedback>{error}</Feedback>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Spinner label="Memproses..." />
            ) : (
              <>
                <LogIn />
                Masuk
              </>
            )}
          </Button>
        </form>
        <details className="mt-6 rounded-lg border bg-slate-50 p-3 text-xs leading-relaxed">
          <summary className="cursor-pointer font-semibold">
            Credentials akun demo untuk technical test
          </summary>
          <ul className="mt-2 space-y-1">
            <li>Admin: admin / admin123</li>
            <li>SPV: spv / spv123</li>
            <li>Mechanic: mekanik / mekanik123</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
