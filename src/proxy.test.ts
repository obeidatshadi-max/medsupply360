import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const call = (path: string, cookie?: string) =>
  proxy(new NextRequest(`https://example.test${path}`, cookie ? { headers: { cookie } } : undefined));
const location = (r: Response) => r.headers.get("location");

describe("proxy: front page", () => {
  afterEach(() => {
    delete process.env.OPEN_ACCESS;
  });

  it("lets a visitor without a session see the front page, in both languages", () => {
    for (const path of ["/", "/ar"]) {
      const r = call(path);
      expect(r.status).toBe(200);
      expect(location(r)).toBeNull();
    }
  });

  it("sends a signed-in visitor from the front page to the dashboard", () => {
    for (const path of ["/", "/ar"]) expect(location(call(path, "sadaf_session=abc"))).toBe("https://example.test/dashboard");
  });

  it("keeps sending everyone to the dashboard while open access is on", () => {
    process.env.OPEN_ACCESS = "true";
    expect(location(call("/"))).toBe("https://example.test/dashboard");
  });

  it("still sends an unauthenticated visitor from a private page to sign in", () => {
    expect(location(call("/dashboard"))).toBe("https://example.test/login");
  });
});
