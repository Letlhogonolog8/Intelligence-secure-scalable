import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Muted } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { supabase } from "@/lib/supabase";
import { getLocationSafe, type Coords } from "@/features/sos/escalation";
import { useRegion } from "@/shared/region";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

interface ResourceRow {
  id: string;
  resource_type: string | null;
  name: string | null;
  description: string | null;
  contact_info: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  available_24_7: boolean | null;
  languages_spoken: string[] | null;
}

type Category = {
  key: string;
  label: string;
  icon: IconName;
  match: (type: string) => boolean;
};

const CATEGORIES: Category[] = [
  { key: "all", label: "All", icon: "location", match: () => true },
  {
    key: "shelter",
    label: "Shelters",
    icon: "home",
    match: (ty) => /shelter|safe ?house|housing|refuge/.test(ty),
  },
  {
    key: "medical",
    label: "Medical",
    icon: "heart",
    match: (ty) => /medic|health|clinic|hospital/.test(ty),
  },
  {
    key: "legal",
    label: "Legal",
    icon: "report",
    match: (ty) => /legal|law|justice|paralegal/.test(ty),
  },
  {
    key: "counsel",
    label: "Counseling",
    icon: "chat",
    match: (ty) => /counsel|therap|psych|support|mental/.test(ty),
  },
  {
    key: "police",
    label: "Police",
    icon: "shield",
    match: (ty) => /police|safety|saps|security/.test(ty),
  },
];

function iconForType(type: string): IconName {
  const ty = type.toLowerCase();
  return CATEGORIES.slice(1).find((c) => c.match(ty))?.icon ?? "location";
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Great-circle distance in km between two WGS84 points. */
function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function phoneFrom(contact?: string | null): string | null {
  if (!contact) return null;
  const match = contact.match(/[+]?\d[\d\s().-]{4,}/);
  if (!match) return null;
  const dial = match[0].replace(/[^\d+]/g, "");
  return dial.length >= 5 ? dial : null;
}

function openDirections(
  name: string,
  lat: number | null,
  lng: number | null,
  region?: string,
) {
  let url: string | undefined;
  if (lat != null && lng != null) {
    const ll = `${lat},${lng}`;
    url = Platform.select({
      ios: `http://maps.apple.com/?ll=${ll}&q=${encodeURIComponent(name)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    });
  } else {
    const q = encodeURIComponent(region ? `${name}, ${region}` : name);
    url = Platform.select({
      ios: `http://maps.apple.com/?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    });
  }
  if (url) Linking.openURL(url).catch(() => {});
}

function ResourceCard({
  r,
  region,
  distance,
}: {
  r: ResourceRow;
  region: string;
  distance: number | null;
}) {
  const { t } = useTranslation();
  const name = r.name ?? t("resources.unnamed", "Support service");
  const phone = phoneFrom(r.contact_info);
  const lat = toNum(r.latitude);
  const lng = toNum(r.longitude);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Icon
            name={iconForType(r.resource_type ?? "")}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{name}</Text>
          <View style={styles.metaRow}>
            {r.resource_type ? (
              <Text style={styles.cardType}>
                {r.resource_type.replace(/_/g, " ")}
              </Text>
            ) : null}
            {distance != null ? (
              <Text style={styles.distance}>
                <Text style={styles.dot}>·</Text> {formatDistance(distance)}{" "}
                {t("resources.away", "away")}
              </Text>
            ) : null}
          </View>
        </View>
        {r.available_24_7 ? (
          <View style={styles.badge247}>
            <Text style={styles.badge247Text}>
              {t("resources.open247", "Open 24/7")}
            </Text>
          </View>
        ) : null}
      </View>

      {r.address ? <Text style={styles.address}>{r.address}</Text> : null}
      {r.description ? (
        <Text style={styles.cardDesc}>{r.description}</Text>
      ) : null}

      {r.languages_spoken && r.languages_spoken.length > 0 ? (
        <View style={styles.langRow}>
          {r.languages_spoken.slice(0, 4).map((l) => (
            <View key={l} style={styles.langChip}>
              <Text style={styles.langText}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("resources.call", "Call")} ${name}`}
            onPress={() => Linking.openURL(`tel:${phone}`).catch(() => {})}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.callBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="call" size={16} color="#fff" />
            <Text style={styles.callText}>{t("resources.call", "Call")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("resources.directions", "Directions")} ${name}`}
          onPress={() => openDirections(name, lat, lng, region)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.dirBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Icon name="map" size={16} color={colors.primary} />
          <Text style={styles.dirText}>
            {t("resources.directions", "Directions")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ResourcesView() {
  const { t } = useTranslation();
  const { country, countries, setCountry } = useRegion();
  const [picking, setPicking] = useState(false);
  const [active, setActive] = useState("all");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async (): Promise<ResourceRow[]> => {
      const { data } = await supabase
        .from("resources")
        .select(
          "id,resource_type,name,description,contact_info,address,latitude,longitude,available_24_7,languages_spoken",
        )
        .order("name", { ascending: true })
        .limit(100);
      return (data as ResourceRow[] | null) ?? [];
    },
  });

  async function useMyLocation() {
    setLocating(true);
    const c = await getLocationSafe();
    setCoords(c);
    setLocating(false);
  }

  const cat = CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0];
  const items = (resources ?? [])
    .filter((r) => cat.match((r.resource_type ?? "").toLowerCase()))
    .map((r) => {
      const lat = toNum(r.latitude);
      const lng = toNum(r.longitude);
      const distance =
        coords && lat != null && lng != null
          ? haversineKm(coords.lat, coords.lng, lat, lng)
          : null;
      return { r, distance };
    });
  if (coords) {
    items.sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Emergency lines (region) */}
      <View style={styles.emergencyCard}>
        <View style={styles.regionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>
              {t("resources.emergency", "Emergency lines")}
            </Text>
            <Muted style={{ fontSize: font.small }}>
              {country.flag}{" "}
              {t("resources.regionFor", { country: country.name })}
            </Muted>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicking((p) => !p)}
            style={({ pressed }) => [
              styles.changeBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.changeText}>
              {t("common.change", "Change")}
            </Text>
          </Pressable>
        </View>

        {picking ? (
          <View style={styles.countryGrid}>
            {countries.map((c) => (
              <Pressable
                key={c.code}
                accessibilityRole="button"
                accessibilityState={{ selected: c.code === country.code }}
                onPress={() => {
                  setCountry(c.code);
                  setPicking(false);
                }}
                style={[
                  styles.countryChip,
                  c.code === country.code && styles.countryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.countryText,
                    c.code === country.code && styles.countryTextActive,
                  ]}
                >
                  {c.flag} {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {country.services.map((svc) => (
            <View key={svc.id} style={styles.svcRow}>
              <Text style={styles.svcLabel}>{t(`services.${svc.id}`)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("resources.call", "Call")} ${t(`services.${svc.id}`)} ${svc.number}`}
                onPress={() =>
                  Linking.openURL(`tel:${svc.dial}`).catch(() => {})
                }
                style={({ pressed }) => [
                  styles.svcCall,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Icon name="call" size={14} color="#fff" />
                <Text style={styles.svcCallText}>{svc.number}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {/* Nearby services */}
      <View style={{ gap: spacing.sm }}>
        <View style={styles.nearbyHead}>
          <Text style={styles.sectionLabel}>
            {t("resources.nearby", "Support services")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={useMyLocation}
            disabled={locating}
            style={({ pressed }) => [
              styles.locBtn,
              coords && styles.locBtnOn,
              pressed && { opacity: 0.85 },
            ]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon
                name="location"
                size={14}
                color={coords ? colors.success : colors.primary}
              />
            )}
            <Text style={[styles.locText, coords && { color: colors.success }]}>
              {coords
                ? t("resources.usingLocation", "Sorted by distance")
                : t("resources.useLocation", "Use my location")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {CATEGORIES.map((c) => {
            const on = c.key === active;
            return (
              <Pressable
                key={c.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setActive(c.key)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Icon
                  name={c.icon}
                  size={15}
                  color={on ? "#fff" : colors.textMuted}
                />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {t(`resources.cat_${c.key}`, c.label)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.lg }}
          />
        ) : items.length > 0 ? (
          items.map(({ r, distance }) => (
            <ResourceCard
              key={r.id}
              r={r}
              region={country.name}
              distance={distance}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="location" size={24} color={colors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>
              {t("resources.noneTitle", "No services listed yet")}
            </Text>
            <Muted style={{ fontSize: font.small, textAlign: "center" }}>
              {t(
                "resources.noneSub",
                "Use the emergency lines above. Local services will appear here as they're added.",
              )}
            </Muted>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  emergencyCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emergencyTitle: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
  },
  regionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  changeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  changeText: {
    color: colors.primary,
    fontSize: font.small,
    fontWeight: "700",
  },
  countryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countryChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  countryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "1f",
  },
  countryText: { color: colors.text, fontSize: font.small, fontWeight: "600" },
  countryTextActive: { color: colors.primary },
  svcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  svcLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: "700",
    fontSize: font.body,
  },
  svcCall: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: TOUCH_MIN - 10,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  svcCallText: { color: "#fff", fontWeight: "800", fontSize: font.small },

  nearbyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary + "55",
    backgroundColor: colors.primary + "12",
  },
  locBtnOn: {
    borderColor: colors.success + "55",
    backgroundColor: colors.success + "12",
  },
  locText: { color: colors.primary, fontSize: font.tiny, fontWeight: "800" },

  tabsRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: font.small, fontWeight: "700" },
  tabTextOn: { color: "#fff" },

  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: { color: colors.text, fontSize: font.body, fontWeight: "800" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 1,
  },
  cardType: {
    color: colors.textFaint,
    fontSize: font.tiny,
    textTransform: "capitalize",
  },
  distance: { color: colors.primary, fontSize: font.tiny, fontWeight: "700" },
  dot: { color: colors.textFaint },
  badge247: {
    backgroundColor: colors.success + "1F",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badge247Text: {
    color: colors.success,
    fontSize: font.tiny,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  address: { color: colors.textFaint, fontSize: font.small },
  cardDesc: { color: colors.textMuted, fontSize: font.small, lineHeight: 19 },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  langChip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  langText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    flex: 1,
    minHeight: TOUCH_MIN - 6,
    borderRadius: radius.md,
  },
  callBtn: { backgroundColor: colors.primary },
  callText: { color: "#fff", fontWeight: "800", fontSize: font.small },
  dirBtn: {
    borderWidth: 1,
    borderColor: colors.primary + "55",
    backgroundColor: colors.primary + "12",
  },
  dirText: { color: colors.primary, fontWeight: "800", fontSize: font.small },

  empty: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    height: 52,
    width: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: { color: colors.text, fontSize: font.body, fontWeight: "700" },
});
