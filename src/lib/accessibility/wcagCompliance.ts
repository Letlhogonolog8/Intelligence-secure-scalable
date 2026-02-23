/**
 * WCAG 2.1 AA Compliance Module
 * src/lib/accessibility/wcagCompliance.ts
 *
 * Implements Web Content Accessibility Guidelines 2.1 Level AA
 * Tailored for South African context with rural connectivity considerations
 */

export interface AccessibilityAuditResult {
  timestamp: Date;
  category: string;
  passed: number;
  failed: number;
  warnings: number;
  score: number;
  status: 'pass' | 'warning' | 'fail';
}

export interface AccessibilityReport {
  audited_url: string;
  audit_date: Date;
  wcag_level: '2.1 AA' | '2.1 AAA';
  results: AccessibilityAuditResult[];
  violations: Array<{
    issue: string;
    severity: 'critical' | 'major' | 'minor';
    count: number;
    remediation: string;
  }>;
  overall_score: number;
}

export const WCAG_REQUIREMENTS = {
  PERCEIVABLE: {
    description: 'Information must be perceivable',
    guideline_1_1: {
      name: 'Text Alternatives',
      requirement: 'All images have text alternatives',
      south_africa_context: 'Critical for non-visual users, rural low-bandwidth areas',
    },
    guideline_1_3: {
      name: 'Adaptable',
      requirement: 'Content can be presented in different ways',
      south_africa_context: 'Support multiple languages, large text, high contrast',
    },
    guideline_1_4: {
      name: 'Distinguishable',
      requirements: {
        contrast: '4.5:1 for normal text (Level AA)',
        color_blindness: "Don't rely on color alone",
        text_resize: 'Text must be resizable without loss of content',
        visual_presentation:
          'No more than 3 colors per 1000 pixels; support high contrast mode',
      },
      south_africa_context:
        'Vision impairment common in aging population; support vision correction',
    },
  },

  OPERABLE: {
    description: 'Interface must be operable',
    guideline_2_1: {
      name: 'Keyboard Accessible',
      requirement: 'All functionality available from keyboard',
      south_africa_context: 'Rural areas may lack mouse support; USSD/mobile priority',
    },
    guideline_2_2: {
      name: 'Enough Time',
      requirement: 'Users have enough time to complete actions',
      south_africa_context: 'Low connectivity areas need extended timeouts',
    },
    guideline_2_4: {
      name: 'Navigable',
      requirements: {
        focus_order: 'Logical focus order',
        focus_visible: 'Focus indicator always visible',
        purpose: 'Purpose of links is clear',
      },
      south_africa_context: 'Simple, predictable navigation for illiterate users',
    },
  },

  UNDERSTANDABLE: {
    description: 'Information and interface must be understandable',
    guideline_3_1: {
      name: 'Readable',
      requirement: 'Text is readable and understandable',
      south_africa_context: 'Grade 8 reading level, vernacular languages, voice guidance',
    },
    guideline_3_2: {
      name: 'Predictable',
      requirement: 'Pages appear and operate predictably',
      south_africa_context: 'Consistent navigation, predictable patterns',
    },
    guideline_3_3: {
      name: 'Input Assistance',
      requirement: 'Error prevention and recovery',
      south_africa_context:
        'Clear error messages, undo functionality, confirmation for sensitive actions',
    },
  },

  ROBUST: {
    description: 'Content must be robust enough to be interpreted by assistive technologies',
    guideline_4_1: {
      name: 'Compatible',
      requirement: 'Compatible with assistive technologies',
      south_africa_context:
        'Screen readers, speech input, alternative input methods, low vision aids',
    },
  },

  SA_SPECIFIC: {
    rural_connectivity: {
      description: 'Works on 2G/3G networks',
      measures: [
        'Minimal data usage (< 1MB per page)',
        'Offline-first capabilities',
        'Progressive enhancement',
        'Optimized images (WebP, compression)',
      ],
    },
    language_support: {
      description: 'Multi-language support for South African languages',
      languages: [
        'en',
        'af',
        'zu',
        'xh',
        'st',
        'tn',
        'ss',
        've',
        'nr',
      ],
      measures: [
        'UI fully translated',
        'Right-to-left support (if needed)',
        'Language detection and switching',
        'Cultural sensitivity review',
      ],
    },
    low_literacy: {
      description: 'Support for users with low literacy levels',
      measures: [
        'Icon-based navigation',
        'Voice guidance and audio cues',
        'Simple language (grade 8 reading level)',
        'Visual step-by-step instructions',
        'Minimal text-heavy interfaces',
      ],
    },
  },
};

export class WCAGCompliance {
  /**
   * Check color contrast ratio (WCAG 1.4.3)
   */
  checkContrast(foreground: string, background: string): {
    ratio: number;
    passes_aa: boolean;
    passes_aaa: boolean;
  } {
    const fgColor = this.hexToRgb(foreground);
    const bgColor = this.hexToRgb(background);

    const fgLum = this.getRelativeLuminance(fgColor);
    const bgLum = this.getRelativeLuminance(bgColor);

    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);

    const ratio = (lighter + 0.05) / (darker + 0.05);

    return {
      ratio: Math.round(ratio * 100) / 100,
      passes_aa: ratio >= 4.5,
      passes_aaa: ratio >= 7,
    };
  }

  /**
   * Validate keyboard navigation capability
   */
  validateKeyboardNavigation(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    const interactive = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"]'
    );

    interactive.forEach((element) => {
      const style = window.getComputedStyle(element);

      if (style.visibility === 'hidden' || style.display === 'none') {
        return;
      }

      const tabindex = (element as HTMLElement).getAttribute('tabindex');
      if (
        tabindex &&
        (parseInt(tabindex) > 0 ||
          parseInt(tabindex) < -1)
      ) {
        issues.push(
          `Element has improper tabindex: ${tabindex}`
        );
      }
    });

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  /**
   * Check text resize capability
   */
  validateTextResize(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6');

    textElements.forEach((element) => {
      const style = window.getComputedStyle(element);
      const fontSize = style.fontSize;

      if (
        fontSize.includes('px') &&
        parseInt(fontSize) < 12
      ) {
        issues.push(
          `Text too small: ${fontSize} on element: ${element.textContent?.substring(0, 50)}`
        );
      }

      if (style.textDecoration.includes('underline')) {
        const color = style.color;
        const bgColor = style.backgroundColor;

        const contrast = this.checkContrast(color, bgColor);
        if (!contrast.passes_aa) {
          issues.push(`Low contrast on underlined text: ratio ${contrast.ratio}`);
        }
      }
    });

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate focus indicators
   */
  validateFocusIndicators(): { compliant: boolean; missing: string[] } {
    const missing: string[] = [];

    const interactive = document.querySelectorAll(
      'a:not([href]), button, input, select, textarea, [role="button"]'
    );

    interactive.forEach((element) => {
      const style = window.getComputedStyle(element);
      const outline = style.outline;
      const boxShadow = style.boxShadow;

      if (
        outline === 'none' &&
        !boxShadow
      ) {
        missing.push(`No focus indicator on: ${(element as HTMLElement).id || element.tagName}`);
      }
    });

    return {
      compliant: missing.length === 0,
      missing,
    };
  }

  /**
   * Check image alt text (WCAG 1.1.1)
   */
  validateAltText(): { compliant: boolean; missing: string[] } {
    const missing: string[] = [];

    const images = document.querySelectorAll('img');

    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const title = img.getAttribute('title');

      if (!alt && !title) {
        missing.push(`Image missing alt text: ${img.src}`);
      }

      if (alt && alt.length < 5 && alt !== '') {
        missing.push(`Alt text too brief: "${alt}"`);
      }
    });

    return {
      compliant: missing.length === 0,
      missing,
    };
  }

  /**
   * Validate semantic HTML structure
   */
  validateSemanticHTML(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    const buttons = document.querySelectorAll('[role="button"]');
    buttons.forEach((btn) => {
      if ((btn as HTMLElement).tagName !== 'BUTTON') {
        issues.push(
          `Role="button" on non-button element: ${(btn as HTMLElement).tagName}`
        );
      }
    });

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt((heading as HTMLElement).tagName[1]);
      if (level > previousLevel + 1) {
        issues.push(`Heading hierarchy skipped: from H${previousLevel} to H${level}`);
      }
      previousLevel = level;
    });

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate comprehensive accessibility audit
   */
  async generateAuditReport(): Promise<AccessibilityReport> {
    const contrastResults = this.validateTextResize();
    const keyboardResults = this.validateKeyboardNavigation();
    const focusResults = this.validateFocusIndicators();
    const altTextResults = this.validateAltText();
    const semanticResults = this.validateSemanticHTML();
    const textResizeResults = this.validateTextResize();

    const allResults = [
      { category: 'Text Contrast', ...contrastResults },
      { category: 'Keyboard Navigation', ...keyboardResults },
      { category: 'Focus Indicators', ...focusResults },
      { category: 'Alt Text', ...altTextResults },
      { category: 'Semantic HTML', ...semanticResults },
      { category: 'Text Resize', ...textResizeResults },
    ];

    const passedCategories = allResults.filter((r) => r.compliant).length;
    const totalCategories = allResults.length;
    const overallScore = Math.round((passedCategories / totalCategories) * 100);

    const violations = allResults
      .filter((r) => !r.compliant)
      .map((r) => ({
        issue: `${r.category} failures`,
        severity:
          (r as Record<string, unknown>).issues?.length > 5 ? 'critical' : 'major',
        count: ((r as Record<string, unknown>).issues as unknown[])?.length || 0,
        remediation: this.getRemediation(r.category),
      }));

    return {
      audited_url: window.location.href,
      audit_date: new Date(),
      wcag_level: '2.1 AA',
      results: allResults.map((r) => ({
        timestamp: new Date(),
        category: r.category,
        passed: r.compliant ? 1 : 0,
        failed: r.compliant ? 0 : 1,
        warnings: 0,
        score: r.compliant ? 100 : 0,
        status: r.compliant ? 'pass' : 'fail',
      })),
      violations,
      overall_score: overallScore,
    };
  }

  /**
   * Private helper: Convert hex to RGB
   */
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
      : [0, 0, 0];
  }

  /**
   * Private helper: Get relative luminance
   */
  private getRelativeLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Get remediation guidance
   */
  private getRemediation(category: string): string {
    const remediations: Record<string, string> = {
      'Text Contrast': 'Increase contrast ratio to minimum 4.5:1 for normal text',
      'Keyboard Navigation': 'Ensure all interactive elements are keyboard accessible',
      'Focus Indicators': 'Add visible focus indicators to all focusable elements',
      'Alt Text': 'Add descriptive alt text to all images',
      'Semantic HTML': 'Use proper semantic HTML elements (button, nav, heading)',
      'Text Resize': 'Allow text to be resized up to 200% without loss of functionality',
    };

    return remediations[category] || 'Review WCAG guidelines for this category';
  }
}

export const wcagCompliance = new WCAGCompliance();
