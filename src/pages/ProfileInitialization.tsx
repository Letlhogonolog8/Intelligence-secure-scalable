/**
 * Profile Initialization System
 * Handles secure user registration and profile setup
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserRole } from "@/types/auth";
import { ROLE_AUTH_POLICIES, canSelfRegister } from "@/lib/roleAuthPolicy";
import { createUsernameUser, supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import { useAuth } from "@/hooks/use-auth";

interface ProfileInitializationPayload {
  username: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  survivorName: string;
  phoneNumber: string;
  dateOfBirth: string;
  province: string;
  cityTown: string;
  physicalAddress: string;
  gpsCoordinates: string;
  emergencyContact: string;
  consentAccepted: boolean;
  title: string;
  department: string;
  organizationName: string;
  legalDesignation: string;
  systemAlias: string;
  enableBiometric: boolean;
  createdAt: Date;
}

interface ProfileInitializationProps {
  role?: UserRole;
  onProfileCreated?: (profile: ProfileInitializationPayload) => void;
  onCancel?: () => void;
}

const ProfileInitialization: React.FC<ProfileInitializationProps> = ({
  role,
  onProfileCreated,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithPassword, signOut, user: currentUser } = useAuth();
  const resolvedRole = role ?? (searchParams.get("role") as UserRole | null);
  const policy = resolvedRole ? ROLE_AUTH_POLICIES[resolvedRole] : undefined;
  const activeRole = policy ? resolvedRole : null;

  const [currentStep, setCurrentStep] = useState<"personal" | "professional" | "security">(
    "personal",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [isAdminCreator, setIsAdminCreator] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      if (!activeRole) {
        navigate("/auth", { replace: true });
        return;
      }

      // If role allows self-registration, allow. Otherwise only allow if current user is admin.
      if (canSelfRegister(activeRole)) {
        return;
      }

      if (!currentUser) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data } = await supabase.from("user_profiles").select("role").eq("id", currentUser.id).maybeSingle();
      if (!mounted) return;
      const isAdmin = data?.role === "admin";
      setIsAdminCreator(isAdmin);
      if (!isAdmin) {
        navigate("/auth", { replace: true });
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [activeRole, navigate, currentUser]);

  const handleCancel = onCancel ?? (() => navigate("/auth"));
  const handleProfileCreated =
    onProfileCreated ?? ((_profile: ProfileInitializationPayload) => {
      navigate("/auth");
    });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [survivorName, setSurvivorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [province, setProvince] = useState("");
  const [cityTown, setCityTown] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [gpsCoordinates, setGpsCoordinates] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [legalDesignation, setLegalDesignation] = useState("");

  const [systemAlias, setSystemAlias] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enableBiometric, setEnableBiometric] = useState(false);
  const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
  const buildAuthEmail = (value: string) => `${value.trim().toLowerCase()}@aegis.example`;

  const handleDetectLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Location services are not available in this browser");
      setLocationStatus("error");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
        setGpsCoordinates(coordinates);
        setLocationStatus("success");
      },
      () => {
        setLocationStatus("error");
        setError("Unable to detect GPS location. Please enter coordinates manually.");
      }
    );
  };

  const handleNextStep = () => {
    setError(null);

    if (currentStep === "personal") {
      if (activeRole === "survivor") {
        if (!survivorName.trim()) {
          setError("Full name or alias is required");
          return;
        }
        if (!province.trim()) {
          setError("Province is required");
          return;
        }
        if (!cityTown.trim()) {
          setError("City or town is required");
          return;
        }
      } else {
        if (!firstName.trim()) {
          setError("First name is required");
          return;
        }
        if (!lastName.trim()) {
          setError("Last name is required");
          return;
        }
      }
      if (!systemAlias.trim()) {
        setError("Username is required");
        return;
      }
      if (!usernamePattern.test(systemAlias.trim())) {
        setError("Username must be 3-24 characters and may include letters, numbers, dots, dashes, or underscores");
        return;
      }
      if (!phoneNumber.trim()) {
        setError("Phone number is required");
        return;
      }
      if (activeRole === "survivor" && !consentAccepted) {
        setError("Consent and privacy agreement is required");
        return;
      }
      setCurrentStep("professional");
    } else if (currentStep === "professional") {
      if (activeRole !== "survivor" && !organizationName.trim()) {
        setError("Organization name is required");
        return;
      }
      setCurrentStep("security");
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!activeRole) {
      return;
    }

    // Extra guard: ensure only roles that allow self-registration can submit
    // or allow if the current logged-in user is an admin creating the profile
    if (!canSelfRegister(activeRole) && !isAdminCreator) {
      setError("Registration is not allowed for the selected role");
      return;
    }

    if (!systemAlias.trim()) {
      setError("Username is required");
      return;
    }
    if (!usernamePattern.test(systemAlias.trim())) {
      setError("Username must be 3-24 characters and may include letters, numbers, dots, dashes, or underscores");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (activeRole === "survivor") {
      if (!survivorName.trim()) {
        setError("Full name or alias is required");
        return;
      }
      if (!province.trim() || !cityTown.trim()) {
        setError("Province and city/town are required");
        return;
      }
      if (!consentAccepted) {
        setError("Consent and privacy agreement is required");
        return;
      }
    }

    if (!hasSupabase) {
      setError("Supabase is not configured. Registration is unavailable.");
      return;
    }

    setLoading(true);

    const fullName = activeRole === "survivor" ? survivorName.trim() : `${firstName} ${lastName}`.trim();
    const isActive = !(policy?.requiresApproval ?? false);

    const { data: createData, error: createError } = await createUsernameUser({
      username: systemAlias.trim(),
      password,
      full_name: fullName,
    });

    if (createError || createData?.success === false || !createData?.user_id) {
      setLoading(false);
      const message = createData?.error || createError?.message || "Registration failed";
      setError(message.replace(/email/gi, "username"));
      return;
    }

    const authEmail = buildAuthEmail(systemAlias);
    const { error: signInError, user, session } = await signInWithPassword(authEmail, password);
    if (signInError || !user) {
      setLoading(false);
      const message = signInError?.message || "Authentication failed";
      setError(message.replace(/email/gi, "username"));
      return;
    }

    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert({
        id: user.id,
        role: activeRole,
        full_name: fullName,
        is_active: isActive,
        organization_id: null,
      });

    if (profileError) {
      await signOut();
      setLoading(false);
      const message = profileError?.message || "Unable to create profile. Please contact support.";
      setError(message.replace(/email/gi, "username"));
      return;
    }

    if (activeRole === "survivor") {
      const { data: survivorData, error: survivorError } = await supabase.functions.invoke("register_survivor", {
        body: {
          user_id: user.id,
          full_name: fullName,
          email: null,
          phone_number: phoneNumber.trim(),
          emergency_contact: emergencyContact.trim() || null,
          consent: true,
          location: {
            province: province.trim(),
            city_town: cityTown.trim(),
            physical_address: physicalAddress.trim() || null,
            gps_coordinates: gpsCoordinates.trim() || null,
          },
        },
      });
      if (survivorError) {
        await signOut();
        setLoading(false);
        const message = survivorError?.message || survivorData?.error || "Unable to complete survivor registration.";
        setError(message.replace(/email/gi, "username"));
        return;
      }
    }

    if (session) {
      await signOut();
    }

    setSuccess(true);

    const profile = {
      username: systemAlias,
      role: activeRole,
      firstName,
      lastName,
      survivorName,
      phoneNumber,
      dateOfBirth,
      province,
      cityTown,
      physicalAddress,
      gpsCoordinates,
      emergencyContact,
      consentAccepted,
      title,
      department,
      organizationName,
      legalDesignation,
      systemAlias,
      enableBiometric,
      createdAt: new Date(),
    };

    setTimeout(() => {
      handleProfileCreated(profile);
    }, 900);
    setLoading(false);
  };

  const roleSpecificFields = {
    survivor: {
      label: "Standard User",
      fields: ["firstName", "lastName", "phoneNumber", "organizationName"],
    },
    counselor: {
      label: "Counselor",
      fields: [
        "firstName",
        "lastName",
        "phoneNumber",
        "title",
        "department",
        "organizationName",
      ],
    },
    police: {
      label: "Police Officer",
      fields: [
        "firstName",
        "lastName",
        "phoneNumber",
        "title",
        "legalDesignation",
        "organizationName",
      ],
    },
    ngo: {
      label: "NGO Representative",
      fields: [
        "firstName",
        "lastName",
        "phoneNumber",
        "title",
        "department",
        "organizationName",
      ],
    },
    analyst: {
      label: "Data Analyst",
      fields: [
        "firstName",
        "lastName",
        "phoneNumber",
        "title",
        "department",
        "organizationName",
      ],
    },
    admin: {
      label: "Administrator",
      fields: [
        "firstName",
        "lastName",
        "phoneNumber",
        "title",
        "department",
        "organizationName",
      ],
    },
  };

  const roleInfo = activeRole ? roleSpecificFields[activeRole] : roleSpecificFields.survivor;
  const stepOrder = ["personal", "professional", "security"] as const;
  const stepLabels = ["Personal Details", "Professional Profile", "Security Setup"];
  const provinces = [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "North West",
    "Northern Cape",
    "Western Cape",
  ];
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const passwordChecks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const passwordScore = passwordChecks.filter(Boolean).length;
  const passwordStrength =
    passwordScore <= 1
      ? { label: "Weak", color: "bg-rose-500" }
      : passwordScore <= 3
        ? { label: "Moderate", color: "bg-blue-500" }
        : { label: "Strong", color: "bg-blue-300" };
  const passwordStrengthWidth = `${(Math.min(passwordScore, 5) / 5) * 100}%`;

  return (
    <div className="min-h-screen bg-[#0a1020] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_16%,rgba(30,64,175,0.32),transparent_46%),radial-gradient(circle_at_85%_18%,rgba(225,29,72,0.2),transparent_55%),radial-gradient(circle_at_30%_85%,rgba(148,163,184,0.18),transparent_46%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(145deg,rgba(7,11,22,0.96),rgba(5,9,18,0.98))]" />
      <div className="fixed top-0 w-full z-40 border-b border-white/5 backdrop-blur-xl bg-[#0a1020]/85">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-slate-700 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-blue-200/70">AEGIS-AI</p>
                <h1 className="text-lg font-semibold">Initialize Profile</h1>
                <p className="text-xs text-slate-400">{roleInfo.label} registration workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="hidden md:inline-flex rounded-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                English
              </Button>
              <Button
                variant="outline"
                className="hidden sm:inline-flex rounded-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
              >
                Emergency
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-screen flex items-center justify-center pt-24 px-4 pb-12 relative z-10">
        <motion.div
          className="w-full max-w-6xl grid lg:grid-cols-[0.4fr_0.6fr] gap-10 items-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div className="space-y-6" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-8 shadow-blue-500/20 shadow-[0_24px_60px_rgba(2,6,23,0.6)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-blue-200">
                Profile initialization
              </div>
              <h2 className="mt-4 text-3xl font-semibold">Build your verified profile</h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                Establish a trusted identity record and complete the registration journey tailored to your role.
              </p>
              <div className="mt-6 space-y-4">
                {stepOrder.map((stepKey, index) => {
                  const isActive = currentStep === stepKey;
                  const isComplete = currentStepIndex > index;
                  return (
                    <div
                      key={stepKey}
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                        isActive
                          ? "border-blue-400/60 bg-blue-500/10"
                          : isComplete
                            ? "border-blue-500/50 bg-blue-500/10"
                            : "border-white/10 bg-slate-950/40"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold ${
                          isComplete
                            ? "bg-blue-600 text-white"
                            : isActive
                              ? "bg-blue-500 text-white"
                              : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {isComplete ? <CheckCircle className="h-5 w-5" /> : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{stepLabels[index]}</p>
                        <p className="text-xs text-slate-400">
                          {isComplete
                            ? "Completed"
                            : isActive
                              ? "In progress"
                              : "Pending"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/10">
                  <Lock className="h-5 w-5 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Verification pipeline</p>
                  <p className="text-xs text-slate-400">Your information is reviewed before activation.</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Restricted roles are subject to manual approval, credential validation, and compliance checks.
              </p>
            </div>
          </motion.div>

          <motion.div className="w-full" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card className="border-white/10 bg-slate-950/75 backdrop-blur-xl shadow-slate-950/50 shadow-[0_24px_60px_rgba(2,6,23,0.65)]">
              <CardHeader className="border-b border-white/10 bg-slate-950/70">
                <CardTitle className="text-xl">Create Your Profile</CardTitle>
                <CardDescription className="text-slate-400">
                  Set up your secure profile to access the AEGIS platform
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-slate-500">
                    {stepLabels.map((label, index) => (
                      <span key={label} className={index <= currentStepIndex ? "text-blue-200" : "text-slate-600"}>
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${((currentStepIndex + 1) / stepOrder.length) * 100}%` }}
                    />
                  </div>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertTitle className="text-green-400">Profile Created</AlertTitle>
                      <AlertDescription className="text-green-300">
                        Your profile is ready. Verify access through your assigned channel, then sign in.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 min-h-80"
                >
                  {currentStep === "personal" && (
                    <div className="space-y-4">
                      {activeRole === "survivor" ? (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Full Name or Alias *</Label>
                            <Input
                              type="text"
                              placeholder="Preferred name"
                              value={survivorName}
                              onChange={(e) => setSurvivorName(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-slate-300">Province *</Label>
                              <Select value={province} onValueChange={setProvince}>
                                <SelectTrigger className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50">
                                  <SelectValue placeholder="Select province" />
                                </SelectTrigger>
                                <SelectContent>
                                  {provinces.map((item) => (
                                    <SelectItem key={item} value={item}>
                                      {item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">City / Town *</Label>
                              <Input
                                type="text"
                                placeholder="City or town"
                                value={cityTown}
                                onChange={(e) => setCityTown(e.target.value)}
                                className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-300">Physical Address (Optional)</Label>
                            <Input
                              type="text"
                              placeholder="Street address or nearest landmark"
                              value={physicalAddress}
                              onChange={(e) => setPhysicalAddress(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-300">GPS Coordinates</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                type="text"
                                placeholder="Latitude,Longitude"
                                value={gpsCoordinates}
                                onChange={(e) => setGpsCoordinates(e.target.value)}
                                className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleDetectLocation}
                                disabled={locationStatus === "loading"}
                              >
                                {locationStatus === "loading" ? "Detecting..." : "Enable Location"}
                              </Button>
                            </div>
                            <p className="text-xs text-slate-400">Auto-detect with device GPS or enter manually.</p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-300">Emergency Contact (Optional)</Label>
                            <Input
                              type="tel"
                              placeholder="Emergency contact number"
                              value={emergencyContact}
                              onChange={(e) => setEmergencyContact(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">First Name *</Label>
                            <Input
                              type="text"
                              placeholder="John"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Last Name *</Label>
                            <Input
                              type="text"
                              placeholder="Doe"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-slate-300">Username *</Label>
                        <Input
                          type="text"
                          value={systemAlias}
                          onChange={(e) => setSystemAlias(e.target.value)}
                          placeholder="Choose a secure username"
                          className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                        />
                        <p className="text-xs text-slate-400">3-24 characters, letters/numbers/dots/dashes/underscores.</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Phone Number *</Label>
                        <Input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Date of Birth (Optional)</Label>
                        <Input
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                        />
                      </div>

                      {activeRole === "survivor" && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-slate-300">
                            <input
                              type="checkbox"
                              checked={consentAccepted}
                              onChange={(e) => setConsentAccepted(e.target.checked)}
                              className="w-4 h-4 rounded bg-slate-800 border-slate-600"
                            />
                            I consent to the privacy and protection agreement.
                          </Label>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === "professional" && (
                    <div className="space-y-4">
                      {activeRole === "survivor" ? (
                        <div className="space-y-2">
                          <Label className="text-slate-300">Support Organization (Optional)</Label>
                          <Input
                            type="text"
                            placeholder="Optional organization"
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                            className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Organization Name *</Label>
                            <Input
                              type="text"
                              placeholder="Your organization"
                              value={organizationName}
                              onChange={(e) => setOrganizationName(e.target.value)}
                              className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                            />
                          </div>

                          {(activeRole === "counselor" || activeRole === "analyst" || activeRole === "admin") && (
                            <>
                              <div className="space-y-2">
                                <Label className="text-slate-300">Job Title</Label>
                                <Input
                                  type="text"
                                  placeholder="Your job title"
                                  value={title}
                                  onChange={(e) => setTitle(e.target.value)}
                                  className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-slate-300">Department</Label>
                                <Input
                                  type="text"
                                  placeholder="Your department"
                                  value={department}
                                  onChange={(e) => setDepartment(e.target.value)}
                                  className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                                />
                              </div>
                            </>
                          )}

                          {(activeRole === "police" || activeRole === "ngo") && (
                            <div className="space-y-2">
                              <Label className="text-slate-300">Legal Designation / Title</Label>
                              <Input
                                type="text"
                                placeholder="Your designation"
                                value={legalDesignation}
                                onChange={(e) => setLegalDesignation(e.target.value)}
                                className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                              />
                            </div>
                          )}

                          <Alert className="border-rose-500/40 bg-rose-500/10">
                            <AlertCircle className="h-4 w-4 text-rose-200" />
                            <AlertTitle className="text-rose-200">Verification Required</AlertTitle>
                            <AlertDescription className="text-rose-200">
                              Your professional information will be verified before full access is granted.
                            </AlertDescription>
                          </Alert>
                        </>
                      )}
                    </div>
                  )}

                  {currentStep === "security" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Password *</Label>
                        <Input
                          type="password"
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50 ${password && passwordScore <= 1 ? "border-rose-500/60" : ""}`}
                        />
                        <div className="space-y-2">
                          <div className="h-2 w-full rounded-full bg-slate-800/70">
                            <div
                              className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                              style={{ width: passwordStrengthWidth }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Strength</span>
                            <span className={passwordScore <= 1 ? "text-rose-300" : "text-blue-200"}>
                              {password ? passwordStrength.label : ""}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">
                          Minimum 8 characters, include upper/lowercase, numbers, and symbols
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Confirm Password *</Label>
                        <Input
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50 ${confirmPassword && password !== confirmPassword ? "border-rose-500/60" : ""}`}
                        />
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-xs text-rose-300">Passwords do not match.</p>
                        )}
                      </div>

                      {policy?.requiresBiometric && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-slate-300">
                            <input
                              type="checkbox"
                              checked={enableBiometric}
                              onChange={(e) => setEnableBiometric(e.target.checked)}
                              className="w-4 h-4 rounded bg-slate-800 border-slate-600"
                            />
                            Enable Biometric Authentication
                          </Label>
                          <p className="text-xs text-slate-400 ml-6">
                            Set up fingerprint or face recognition for faster login (recommended
                            for your role)
                          </p>
                        </div>
                      )}

                      <Alert className="border-blue-500/40 bg-blue-500/10">
                        <Lock className="h-4 w-4 text-blue-200" />
                        <AlertTitle className="text-blue-200">Security Notice</AlertTitle>
                        <AlertDescription className="text-blue-200 text-xs">
                          Your password will be encrypted and stored securely. Never share your
                          credentials.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </motion.div>

                <div className="mt-8 flex gap-3 justify-end">
                  {currentStep! === "professional" || currentStep === "security" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (currentStep === "professional") {
                          setCurrentStep("personal");
                        } else {
                          setCurrentStep("professional");
                        }
                      }}
                    >
                      Back
                    </Button>
                  ) : null}

                  <Button
                    disabled={loading || success}
                    onClick={
                      currentStep === "security" ? handleSubmit : handleNextStep
                    }
                    className="bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 hover:shadow-lg hover:shadow-blue-500/40"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete
                      </>
                    ) : currentStep === "security" ? (
                      <>
                        Create Profile
                        <CheckCircle className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileInitialization;
