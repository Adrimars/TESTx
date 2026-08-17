"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Combobox } from "@testx/ui";
import type { ComboboxOption } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const AGE_OPTIONS: ComboboxOption[] = Array.from({ length: 88 }, (_, i) => {
  const age = i + 13;
  return { value: String(age), label: String(age) };
});

const COUNTRIES: ComboboxOption[] = [
  { value: "AF", label: "Afghanistan" },
  { value: "AL", label: "Albania" },
  { value: "DZ", label: "Algeria" },
  { value: "AR", label: "Argentina" },
  { value: "AM", label: "Armenia" },
  { value: "AU", label: "Australia" },
  { value: "AT", label: "Austria" },
  { value: "AZ", label: "Azerbaijan" },
  { value: "BH", label: "Bahrain" },
  { value: "BD", label: "Bangladesh" },
  { value: "BY", label: "Belarus" },
  { value: "BE", label: "Belgium" },
  { value: "BO", label: "Bolivia" },
  { value: "BA", label: "Bosnia and Herzegovina" },
  { value: "BR", label: "Brazil" },
  { value: "BG", label: "Bulgaria" },
  { value: "CA", label: "Canada" },
  { value: "CL", label: "Chile" },
  { value: "CN", label: "China" },
  { value: "CO", label: "Colombia" },
  { value: "HR", label: "Croatia" },
  { value: "CZ", label: "Czech Republic" },
  { value: "DK", label: "Denmark" },
  { value: "EC", label: "Ecuador" },
  { value: "EG", label: "Egypt" },
  { value: "EE", label: "Estonia" },
  { value: "ET", label: "Ethiopia" },
  { value: "FI", label: "Finland" },
  { value: "FR", label: "France" },
  { value: "GE", label: "Georgia" },
  { value: "DE", label: "Germany" },
  { value: "GH", label: "Ghana" },
  { value: "GR", label: "Greece" },
  { value: "GT", label: "Guatemala" },
  { value: "HU", label: "Hungary" },
  { value: "IN", label: "India" },
  { value: "ID", label: "Indonesia" },
  { value: "IR", label: "Iran" },
  { value: "IQ", label: "Iraq" },
  { value: "IE", label: "Ireland" },
  { value: "IL", label: "Israel" },
  { value: "IT", label: "Italy" },
  { value: "JP", label: "Japan" },
  { value: "JO", label: "Jordan" },
  { value: "KZ", label: "Kazakhstan" },
  { value: "KE", label: "Kenya" },
  { value: "KW", label: "Kuwait" },
  { value: "LV", label: "Latvia" },
  { value: "LB", label: "Lebanon" },
  { value: "LT", label: "Lithuania" },
  { value: "MY", label: "Malaysia" },
  { value: "MX", label: "Mexico" },
  { value: "MA", label: "Morocco" },
  { value: "NL", label: "Netherlands" },
  { value: "NZ", label: "New Zealand" },
  { value: "NG", label: "Nigeria" },
  { value: "NO", label: "Norway" },
  { value: "PK", label: "Pakistan" },
  { value: "PE", label: "Peru" },
  { value: "PH", label: "Philippines" },
  { value: "PL", label: "Poland" },
  { value: "PT", label: "Portugal" },
  { value: "QA", label: "Qatar" },
  { value: "RO", label: "Romania" },
  { value: "RU", label: "Russia" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "RS", label: "Serbia" },
  { value: "SG", label: "Singapore" },
  { value: "SK", label: "Slovakia" },
  { value: "ZA", label: "South Africa" },
  { value: "KR", label: "South Korea" },
  { value: "ES", label: "Spain" },
  { value: "LK", label: "Sri Lanka" },
  { value: "SE", label: "Sweden" },
  { value: "CH", label: "Switzerland" },
  { value: "TW", label: "Taiwan" },
  { value: "TZ", label: "Tanzania" },
  { value: "TH", label: "Thailand" },
  { value: "TN", label: "Tunisia" },
  { value: "TR", label: "Turkey" },
  { value: "UA", label: "Ukraine" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "UY", label: "Uruguay" },
  { value: "UZ", label: "Uzbekistan" },
  { value: "VE", label: "Venezuela" },
  { value: "VN", label: "Vietnam" },
];

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  AT: ["Vienna", "Graz", "Linz", "Salzburg"],
  BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza"],
  CA: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa"],
  CN: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu"],
  CZ: ["Prague", "Brno", "Ostrava"],
  DK: ["Copenhagen", "Aarhus", "Odense"],
  EG: ["Cairo", "Alexandria", "Giza"],
  FR: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice"],
  DE: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"],
  GR: ["Athens", "Thessaloniki", "Patras"],
  IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune"],
  ID: ["Jakarta", "Surabaya", "Bandung", "Medan"],
  IE: ["Dublin", "Cork", "Limerick"],
  IL: ["Tel Aviv", "Jerusalem", "Haifa"],
  IT: ["Rome", "Milan", "Naples", "Turin", "Florence"],
  JP: ["Tokyo", "Osaka", "Nagoya", "Sapporo", "Fukuoka"],
  MY: ["Kuala Lumpur", "Johor Bahru", "Penang", "Ipoh"],
  MX: ["Mexico City", "Guadalajara", "Monterrey", "Tijuana", "Puebla"],
  NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  NZ: ["Auckland", "Wellington", "Christchurch"],
  NG: ["Lagos", "Abuja", "Kano", "Ibadan"],
  NO: ["Oslo", "Bergen", "Trondheim"],
  PK: ["Karachi", "Lahore", "Islamabad", "Faisalabad"],
  PH: ["Manila", "Quezon City", "Davao", "Cebu"],
  PL: ["Warsaw", "Kraków", "Wrocław", "Gdańsk"],
  PT: ["Lisbon", "Porto", "Braga"],
  RO: ["Bucharest", "Cluj-Napoca", "Timișoara"],
  RU: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg"],
  SA: ["Riyadh", "Jeddah", "Mecca", "Medina"],
  SG: ["Singapore"],
  ZA: ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
  KR: ["Seoul", "Busan", "Incheon", "Daegu"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao"],
  SE: ["Stockholm", "Gothenburg", "Malmö"],
  CH: ["Zurich", "Geneva", "Basel", "Bern"],
  TW: ["Taipei", "Kaohsiung", "Taichung"],
  TH: ["Bangkok", "Chiang Mai", "Pattaya"],
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa"],
  UA: ["Kyiv", "Kharkiv", "Odessa", "Dnipro"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  GB: ["London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Edinburgh"],
  US: [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
    "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
    "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte",
    "Seattle", "Denver", "Boston", "Nashville", "Miami",
  ],
  VN: ["Ho Chi Minh City", "Hanoi", "Da Nang"],
};

function getCityOptions(countryCode: string): ComboboxOption[] {
  const cities = CITIES_BY_COUNTRY[countryCode] ?? [];
  return cities.map((c) => ({ value: c, label: c }));
}

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("UNDISCLOSED");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const cityOptions = useMemo(() => getCityOptions(country), [country]);

  function handleCountryChange(value: string) {
    setCountry(value);
    setCity("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!age) {
      setError("Please select your age.");
      return;
    }
    if (!country) {
      setError("Please select your country.");
      return;
    }
    setIsPending(true);
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify({
          age: Number(age),
          gender,
          country,
          city: city || undefined,
        }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Complete demographic profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Age</label>
            <Combobox
              options={AGE_OPTIONS}
              value={age}
              onChange={setAge}
              placeholder="Select age…"
              searchPlaceholder="Search age…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Gender</label>
            <Select
              aria-label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="UNDISCLOSED">Prefer not to say</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Country</label>
            <Combobox
              options={COUNTRIES}
              value={country}
              onChange={handleCountryChange}
              placeholder="Select country…"
              searchPlaceholder="Search country…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">City (optional)</label>
            <Combobox
              options={cityOptions}
              value={city}
              onChange={setCity}
              placeholder={country ? "Select city…" : "Select country first"}
              searchPlaceholder="Search city…"
              disabled={!country || cityOptions.length === 0}
            />
          </div>

          {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
          <Button type="submit" className="sm:col-span-2" disabled={isPending}>
            {isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
