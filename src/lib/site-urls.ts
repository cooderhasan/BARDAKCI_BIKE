/**
 * E-postalardaki linkler için mağaza site adresleri.
 * Motovitrin şimdilik motor.bardakcibike.com.tr'de; alan adı yönlendirmesi yapılınca MOTOR_SITE_URL ile değiştirilir.
 */
export function getStoreSiteUrl(store: "BIKE" | "MOTOR" | string | null | undefined): string {
    if (store === "MOTOR") return (process.env.MOTOR_SITE_URL || "https://motor.bardakcibike.com.tr").replace(/\/+$/, "");
    return "https://www.bardakcibike.com.tr";
}
