import { describe, expect, test } from "bun:test";
import { rateLimitSubject } from "./ip";

describe("rateLimitSubject", () => {
  test("IPv4 はアドレスごとに区別し、表記ゆれは揃える", () => {
    expect(rateLimitSubject("203.0.113.10")).toBe("203.0.113.10");
    expect(rateLimitSubject("203.0.113.010")).toBe("203.0.113.10");
    expect(rateLimitSubject("203.0.113.10")).not.toBe(rateLimitSubject("203.0.113.11"));
  });

  test("IPv6 は /64 にまとめ、展開表記も同じ値になる", () => {
    const prefix = "2001:db8:1:2::/64";
    expect(rateLimitSubject("2001:db8:1:2::1")).toBe(prefix);
    expect(rateLimitSubject("2001:DB8:1:2::1")).toBe(prefix);
    expect(rateLimitSubject("2001:0db8:0001:0002:ffff:ffff:ffff:ffff")).toBe(prefix);
    expect(rateLimitSubject("[2001:db8:1:2::abcd]")).toBe(prefix);
    expect(rateLimitSubject("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(rateLimitSubject("2001:db8:1:3::1")).not.toBe(prefix);
  });

  test("IPv4 射影の IPv6 は元の IPv4 として数える", () => {
    expect(rateLimitSubject("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(rateLimitSubject("::FFFF:203.0.113.5")).toBe("203.0.113.5");
  });

  test("ループバックと解釈できない値", () => {
    expect(rateLimitSubject("::1")).toBe("::/64");
    expect(rateLimitSubject("fe80::1%eth0")).toBe("fe80::/64");
    expect(rateLimitSubject("not-an-ip")).toBe("not-an-ip");
  });
});
