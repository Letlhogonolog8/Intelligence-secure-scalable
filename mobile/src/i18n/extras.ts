/**
 * Supplementary translations for strings added after the strictly-typed locale
 * bundles were authored (the improved Report screen, Voice capture, Evidence
 * Vault, and the Legal Rights titles).
 *
 * These are registered with i18next via `addResourceBundle` (deep-merged) rather
 * than added to the typed `en` bundle, so we can translate the safe UI labels in
 * the languages we're confident in without forcing every one of the 16 locales
 * to carry them. Any language not listed here falls back to the English default
 * already passed inline at each call site — never a missing string.
 *
 * NOTE: the detailed legal-rights *guidance* (the bullet content) is deliberately
 * left in English. Translating safety-critical legal copy into many languages
 * needs professional, reviewed localization — a wrong translation there is worse
 * than an honest English fallback.
 */
import type i18nType from "i18next";

type Extra = {
  report: { when: string; when_today: string; when_yesterday: string; when_earlier: string; anonymous: string; anonymousHint: string };
  voice: { record: string; stop: string; permission: string; startError: string; empty: string; failed: string };
  evidence: {
    title: string; intro: string; privacy: string; add: string; working: string; empty: string;
    added: string; uploadError: string; deleteError: string; loadError: string; permission: string; delete: string;
  };
  legal: {
    title: string; intro: string; disclaimer: string;
    section: { rights: string; protection: string; police: string; medical: string; court: string; privacy: string };
  };
};

const EXTRAS: Record<string, Extra> = {
  en: {
    report: { when: "When did it happen?", when_today: "Today", when_yesterday: "Yesterday", when_earlier: "Earlier", anonymous: "Report anonymously", anonymousHint: "Your identity won't be attached to this report. You won't be able to track it from this device." },
    voice: { record: "Record voice note", stop: "Stop & transcribe", permission: "Microphone access is needed to record.", startError: "Couldn't start recording.", empty: "Couldn't transcribe that — you can type instead.", failed: "Transcription failed — you can type instead." },
    evidence: { title: "Evidence Vault", intro: "Privately store photos and documents tied to your case.", privacy: "Files are private to you and encrypted at rest. Only you can open them from this account.", add: "Add photo / document", working: "Working…", empty: "Your vault is empty. Add a photo to keep it safe.", added: "Evidence saved securely.", uploadError: "Upload failed. Check your connection and try again.", deleteError: "Couldn't delete that file.", loadError: "Couldn't load your vault. Try again once you're online.", permission: "Photo access is needed to add evidence.", delete: "Delete" },
    legal: { title: "Know Your Rights", intro: "Plain-language guidance on your legal rights and next steps.", disclaimer: "This is general information, not legal advice. Laws differ by country. For your situation, contact a local legal aid clinic or the GBV helpline.", section: { rights: "Know your rights", protection: "Protection orders", police: "Reporting to the police", medical: "At the clinic or hospital", court: "Going to court", privacy: "Your privacy & safety" } },
  },
  af: {
    report: { when: "Wanneer het dit gebeur?", when_today: "Vandag", when_yesterday: "Gister", when_earlier: "Vroeër", anonymous: "Rapporteer anoniem", anonymousHint: "Jou identiteit sal nie aan hierdie verslag gekoppel word nie. Jy sal dit nie van hierdie toestel kan opspoor nie." },
    voice: { record: "Neem stemnota op", stop: "Stop en transkribeer", permission: "Mikrofoontoegang word benodig om op te neem.", startError: "Kon nie begin opneem nie.", empty: "Kon dit nie transkribeer nie — jy kan eerder tik.", failed: "Transkripsie het misluk — jy kan eerder tik." },
    evidence: { title: "Bewyskluis", intro: "Stoor foto's en dokumente wat aan jou saak gekoppel is, privaat.", privacy: "Lêers is privaat aan jou en geënkripteer in rus. Net jy kan dit van hierdie rekening af oopmaak.", add: "Voeg foto / dokument by", working: "Besig…", empty: "Jou kluis is leeg. Voeg 'n foto by om dit veilig te hou.", added: "Bewys veilig gestoor.", uploadError: "Oplaai het misluk. Kontroleer jou verbinding en probeer weer.", deleteError: "Kon nie daardie lêer skrap nie.", loadError: "Kon nie jou kluis laai nie. Probeer weer wanneer jy aanlyn is.", permission: "Fototoegang word benodig om bewyse by te voeg.", delete: "Skrap" },
    legal: { title: "Ken Jou Regte", intro: "Eenvoudige leiding oor jou wetlike regte en volgende stappe.", disclaimer: "Dit is algemene inligting, nie regsadvies nie. Wette verskil per land. Kontak vir jou situasie 'n plaaslike regshulpkliniek of die GGV-hulplyn.", section: { rights: "Ken jou regte", protection: "Beskermingsbevele", police: "Rapporteer aan die polisie", medical: "By die kliniek of hospitaal", court: "Hof toe gaan", privacy: "Jou privaatheid en veiligheid" } },
  },
  fr: {
    report: { when: "Quand est-ce arrivé ?", when_today: "Aujourd'hui", when_yesterday: "Hier", when_earlier: "Plus tôt", anonymous: "Signaler anonymement", anonymousHint: "Votre identité ne sera pas associée à ce signalement. Vous ne pourrez pas le suivre depuis cet appareil." },
    voice: { record: "Enregistrer une note vocale", stop: "Arrêter et transcrire", permission: "L'accès au micro est nécessaire pour enregistrer.", startError: "Impossible de démarrer l'enregistrement.", empty: "Transcription impossible — vous pouvez écrire à la place.", failed: "Échec de la transcription — vous pouvez écrire à la place." },
    evidence: { title: "Coffre à preuves", intro: "Conservez en privé des photos et documents liés à votre dossier.", privacy: "Les fichiers vous sont privés et chiffrés au repos. Vous seul pouvez les ouvrir depuis ce compte.", add: "Ajouter une photo / un document", working: "En cours…", empty: "Votre coffre est vide. Ajoutez une photo pour la garder en sécurité.", added: "Preuve enregistrée en toute sécurité.", uploadError: "Échec de l'envoi. Vérifiez votre connexion et réessayez.", deleteError: "Impossible de supprimer ce fichier.", loadError: "Impossible de charger votre coffre. Réessayez une fois en ligne.", permission: "L'accès aux photos est nécessaire pour ajouter des preuves.", delete: "Supprimer" },
    legal: { title: "Connaître vos droits", intro: "Des explications claires sur vos droits et les prochaines étapes.", disclaimer: "Ceci est une information générale, pas un conseil juridique. Les lois varient selon les pays. Pour votre situation, contactez une clinique d'aide juridique locale ou la ligne d'assistance VBG.", section: { rights: "Connaître vos droits", protection: "Ordonnances de protection", police: "Signaler à la police", medical: "À la clinique ou à l'hôpital", court: "Aller au tribunal", privacy: "Votre vie privée et votre sécurité" } },
  },
  pt: {
    report: { when: "Quando aconteceu?", when_today: "Hoje", when_yesterday: "Ontem", when_earlier: "Antes", anonymous: "Denunciar anonimamente", anonymousHint: "A sua identidade não será associada a esta denúncia. Não poderá acompanhá-la a partir deste dispositivo." },
    voice: { record: "Gravar nota de voz", stop: "Parar e transcrever", permission: "É necessário acesso ao microfone para gravar.", startError: "Não foi possível iniciar a gravação.", empty: "Não foi possível transcrever — pode escrever em vez disso.", failed: "Falha na transcrição — pode escrever em vez disso." },
    evidence: { title: "Cofre de provas", intro: "Guarde de forma privada fotos e documentos ligados ao seu caso.", privacy: "Os ficheiros são privados e cifrados em repouso. Só você pode abri-los a partir desta conta.", add: "Adicionar foto / documento", working: "A processar…", empty: "O seu cofre está vazio. Adicione uma foto para a manter segura.", added: "Prova guardada com segurança.", uploadError: "Falha no envio. Verifique a ligação e tente novamente.", deleteError: "Não foi possível eliminar esse ficheiro.", loadError: "Não foi possível carregar o seu cofre. Tente novamente quando estiver online.", permission: "É necessário acesso às fotos para adicionar provas.", delete: "Eliminar" },
    legal: { title: "Conheça os seus direitos", intro: "Orientação em linguagem simples sobre os seus direitos e próximos passos.", disclaimer: "Esta é uma informação geral, não aconselhamento jurídico. As leis variam por país. Para a sua situação, contacte um centro local de apoio jurídico ou a linha de apoio à VBG.", section: { rights: "Conheça os seus direitos", protection: "Ordens de proteção", police: "Denunciar à polícia", medical: "Na clínica ou no hospital", court: "Ir a tribunal", privacy: "A sua privacidade e segurança" } },
  },
  es: {
    report: { when: "¿Cuándo ocurrió?", when_today: "Hoy", when_yesterday: "Ayer", when_earlier: "Antes", anonymous: "Denunciar de forma anónima", anonymousHint: "Tu identidad no se asociará a esta denuncia. No podrás darle seguimiento desde este dispositivo." },
    voice: { record: "Grabar nota de voz", stop: "Detener y transcribir", permission: "Se necesita acceso al micrófono para grabar.", startError: "No se pudo iniciar la grabación.", empty: "No se pudo transcribir — puedes escribir en su lugar.", failed: "La transcripción falló — puedes escribir en su lugar." },
    evidence: { title: "Bóveda de evidencias", intro: "Guarda de forma privada fotos y documentos vinculados a tu caso.", privacy: "Los archivos son privados y están cifrados en reposo. Solo tú puedes abrirlos desde esta cuenta.", add: "Añadir foto / documento", working: "Procesando…", empty: "Tu bóveda está vacía. Añade una foto para mantenerla segura.", added: "Evidencia guardada de forma segura.", uploadError: "Error al subir. Revisa tu conexión e inténtalo de nuevo.", deleteError: "No se pudo eliminar ese archivo.", loadError: "No se pudo cargar tu bóveda. Inténtalo de nuevo cuando estés en línea.", permission: "Se necesita acceso a las fotos para añadir evidencias.", delete: "Eliminar" },
    legal: { title: "Conoce tus derechos", intro: "Orientación en lenguaje claro sobre tus derechos y próximos pasos.", disclaimer: "Esta es información general, no asesoría legal. Las leyes varían según el país. Para tu situación, contacta una clínica de asistencia jurídica local o la línea de ayuda contra la VBG.", section: { rights: "Conoce tus derechos", protection: "Órdenes de protección", police: "Denunciar a la policía", medical: "En la clínica u hospital", court: "Ir a los tribunales", privacy: "Tu privacidad y seguridad" } },
  },
  de: {
    report: { when: "Wann ist es passiert?", when_today: "Heute", when_yesterday: "Gestern", when_earlier: "Früher", anonymous: "Anonym melden", anonymousHint: "Ihre Identität wird nicht mit dieser Meldung verknüpft. Sie können sie von diesem Gerät aus nicht verfolgen." },
    voice: { record: "Sprachnotiz aufnehmen", stop: "Stoppen & transkribieren", permission: "Für die Aufnahme wird Mikrofonzugriff benötigt.", startError: "Aufnahme konnte nicht gestartet werden.", empty: "Konnte nicht transkribiert werden — Sie können stattdessen tippen.", failed: "Transkription fehlgeschlagen — Sie können stattdessen tippen." },
    evidence: { title: "Beweis-Tresor", intro: "Speichern Sie Fotos und Dokumente zu Ihrem Fall privat.", privacy: "Dateien sind privat und ruhend verschlüsselt. Nur Sie können sie über dieses Konto öffnen.", add: "Foto / Dokument hinzufügen", working: "Wird bearbeitet…", empty: "Ihr Tresor ist leer. Fügen Sie ein Foto hinzu, um es zu sichern.", added: "Beweis sicher gespeichert.", uploadError: "Upload fehlgeschlagen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.", deleteError: "Diese Datei konnte nicht gelöscht werden.", loadError: "Tresor konnte nicht geladen werden. Versuchen Sie es erneut, sobald Sie online sind.", permission: "Für das Hinzufügen von Beweisen wird Fotozugriff benötigt.", delete: "Löschen" },
    legal: { title: "Kennen Sie Ihre Rechte", intro: "Verständliche Hinweise zu Ihren Rechten und nächsten Schritten.", disclaimer: "Dies sind allgemeine Informationen, keine Rechtsberatung. Gesetze unterscheiden sich je nach Land. Wenden Sie sich für Ihre Situation an eine örtliche Rechtsberatungsstelle oder die GBV-Hotline.", section: { rights: "Kennen Sie Ihre Rechte", protection: "Schutzanordnungen", police: "Anzeige bei der Polizei", medical: "In der Klinik oder im Krankenhaus", court: "Vor Gericht gehen", privacy: "Ihre Privatsphäre & Sicherheit" } },
  },
  it: {
    report: { when: "Quando è successo?", when_today: "Oggi", when_yesterday: "Ieri", when_earlier: "Prima", anonymous: "Segnala in modo anonimo", anonymousHint: "La tua identità non sarà associata a questa segnalazione. Non potrai seguirla da questo dispositivo." },
    voice: { record: "Registra nota vocale", stop: "Ferma e trascrivi", permission: "È necessario l'accesso al microfono per registrare.", startError: "Impossibile avviare la registrazione.", empty: "Impossibile trascrivere — puoi scrivere invece.", failed: "Trascrizione non riuscita — puoi scrivere invece." },
    evidence: { title: "Cassaforte delle prove", intro: "Conserva in privato foto e documenti legati al tuo caso.", privacy: "I file sono privati e cifrati a riposo. Solo tu puoi aprirli da questo account.", add: "Aggiungi foto / documento", working: "In corso…", empty: "La tua cassaforte è vuota. Aggiungi una foto per metterla al sicuro.", added: "Prova salvata in sicurezza.", uploadError: "Caricamento non riuscito. Controlla la connessione e riprova.", deleteError: "Impossibile eliminare quel file.", loadError: "Impossibile caricare la cassaforte. Riprova quando sei online.", permission: "È necessario l'accesso alle foto per aggiungere prove.", delete: "Elimina" },
    legal: { title: "Conosci i tuoi diritti", intro: "Indicazioni in linguaggio semplice sui tuoi diritti e i prossimi passi.", disclaimer: "Queste sono informazioni generali, non consulenza legale. Le leggi variano da Paese a Paese. Per la tua situazione, contatta un centro di assistenza legale locale o la linea di supporto contro la violenza di genere.", section: { rights: "Conosci i tuoi diritti", protection: "Ordini di protezione", police: "Denunciare alla polizia", medical: "In clinica o in ospedale", court: "Andare in tribunale", privacy: "La tua privacy e sicurezza" } },
  },
};

/** Deep-merge the supplementary strings into i18next for the covered languages. */
export function registerExtraTranslations(i18n: typeof i18nType): void {
  for (const [lng, resources] of Object.entries(EXTRAS)) {
    i18n.addResourceBundle(lng, "translation", resources, true, true);
  }
}
