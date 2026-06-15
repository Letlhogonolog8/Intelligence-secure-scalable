import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SUPPORTED_LANGUAGES } from "@/i18n";

const changeAppLanguage = vi.fn();
const persistPreferredLanguage = vi.fn();

vi.mock("@/i18n", async (importActual) => {
  const actual = await importActual<typeof import("@/i18n")>();
  return {
    ...actual,
    changeAppLanguage: (...a: unknown[]) => changeAppLanguage(...a),
  };
});

vi.mock("@/lib/languageSync", () => ({
  persistPreferredLanguage: (...a: unknown[]) => persistPreferredLanguage(...a),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: "en", language: "en" },
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

beforeEach(() => {
  changeAppLanguage.mockClear();
  persistPreferredLanguage.mockClear();
});

describe("LanguageSwitcher", () => {
  it("renders every supported language as an option", () => {
    render(<LanguageSwitcher variant="compact" />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(SUPPORTED_LANGUAGES.length);
    expect(options.length).toBeGreaterThanOrEqual(50);
  });

  it("shows native labels including the newly bundled languages", () => {
    render(<LanguageSwitcher variant="compact" />);
    for (const label of ["Español", "Português", "中文", "हिन्दी", "isiZulu"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("changes language and syncs the choice on selection", async () => {
    render(<LanguageSwitcher variant="compact" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zu" } });
    expect(changeAppLanguage).toHaveBeenCalledWith("zu");
    // persistPreferredLanguage runs after the awaited language change.
    await waitFor(() =>
      expect(persistPreferredLanguage).toHaveBeenCalledWith("zu"),
    );
  });
});
