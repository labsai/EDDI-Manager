import { describe, expect, it } from "vitest";
import {
  LEGACY_SPACE,
  decodeSubjectPart,
  describeSpace,
  encodeSubjectPart,
  isUserSubject,
  normalizeGroupPath,
  parseSubjectInput,
  spacesFor,
  teamSubject,
  userSubject,
} from "../spaces";

/**
 * These mirror `Subjects.java`. A mismatch does not throw — it builds a space id
 * that matches nothing, which the UI renders as "you have no agents". So the
 * encoding is pinned here rather than left to look obviously right.
 */
describe("subject encoding", () => {
  it("escapes the delimiter so a name cannot forge an extra index token", () => {
    expect(userSubject("alice|user:admin")).toBe("user:alice%7Cuser:admin");
  });

  it("escapes percent so encoding round-trips", () => {
    expect(encodeSubjectPart("a%7Cb")).toBe("a%257Cb");
    expect(decodeSubjectPart("a%257Cb")).toBe("a%7Cb");
  });

  it("leaves ordinary principals alone", () => {
    expect(userSubject("alice@example.com")).toBe("user:alice@example.com");
  });

  it("normalises the slashes Keycloak wraps group paths in", () => {
    expect(teamSubject("/engineering/")).toBe("team:engineering");
    expect(normalizeGroupPath("/engineering")).toBe("engineering");
  });

  it("keeps nested group paths distinct", () => {
    // Membership in a child group is NOT membership in its parent — Keycloak
    // lists the groups a user is actually in, and the backend does not invent
    // ancestry either.
    expect(teamSubject("/engineering/backend")).toBe("team:engineering/backend");
    expect(teamSubject("/engineering/backend")).not.toBe(teamSubject("/engineering"));
  });

  it("returns null for input that names nobody", () => {
    expect(userSubject("")).toBeNull();
    expect(userSubject("   ")).toBeNull();
    expect(teamSubject("///")).toBeNull();
  });
});

describe("spacesFor", () => {
  it("puts the personal space first", () => {
    const spaces = spacesFor("alice", ["/engineering"]);
    expect(spaces.map((s) => s.kind)).toEqual(["personal", "team"]);
    expect(spaces[0]?.id).toBe("user:alice");
    expect(spaces[1]?.id).toBe("team:engineering");
  });

  it("is empty without a principal", () => {
    expect(spacesFor(null, ["/engineering"])).toEqual([]);
  });

  it("has just the personal space when no group claim is present", () => {
    // A realm without a group-membership mapper. A correct answer, not a failure.
    expect(spacesFor("alice", [])).toHaveLength(1);
  });

  it("does not list the same team twice", () => {
    expect(spacesFor("alice", ["/engineering", "engineering"])).toHaveLength(2);
  });

  it("labels a team by its normalised path", () => {
    expect(spacesFor("alice", ["/engineering"])[1]?.label).toBe("engineering");
  });
});

describe("describeSpace", () => {
  it("renders user and team spaces for humans", () => {
    expect(describeSpace("user:alice@example.com")).toBe("alice@example.com");
    expect(describeSpace("team:engineering")).toBe("engineering");
  });

  it("decodes an escaped name back", () => {
    expect(describeSpace("user:a%7Cb")).toBe("a|b");
  });

  it("passes through legacy and unknown ids rather than guessing", () => {
    // An unrecognised space is something a reader should see and report, not
    // something to paper over with a friendly-looking guess.
    expect(describeSpace(LEGACY_SPACE)).toBe(LEGACY_SPACE);
    expect(describeSpace("something:else")).toBe("something:else");
  });

  it("is null for nothing", () => {
    expect(describeSpace(null)).toBeNull();
    expect(describeSpace(undefined)).toBeNull();
  });
});

describe("parseSubjectInput", () => {
  it("reads a bare name as a person, because that is what people type", () => {
    expect(parseSubjectInput("alice@example.com")).toEqual({ subject: "user:alice@example.com" });
  });

  it("accepts explicit prefixes", () => {
    expect(parseSubjectInput("user:alice")).toEqual({ subject: "user:alice" });
    expect(parseSubjectInput("team:/engineering")).toEqual({ subject: "team:engineering" });
  });

  it("rejects an unknown prefix rather than guessing", () => {
    // A typo that silently became a subject nobody holds looks exactly like a
    // successful share.
    expect(parseSubjectInput("group:engineering")).toEqual({ error: "unknown-prefix" });
  });

  it("rejects empty input", () => {
    expect(parseSubjectInput("   ")).toEqual({ error: "empty" });
  });

  it("trims what was typed", () => {
    expect(parseSubjectInput("  alice  ")).toEqual({ subject: "user:alice" });
  });
});

describe("isUserSubject", () => {
  it("separates people from teams", () => {
    expect(isUserSubject("user:alice")).toBe(true);
    expect(isUserSubject("team:engineering")).toBe(false);
  });
});
