export interface AddressFixture {
  id: string
  bezirk: string
  strasse: string
  plz: string
  ort: string
}

export const ADDRESS_FIXTURES: AddressFixture[] = [
  { id: "charlottenburg-01", bezirk: "Charlottenburg", strasse: "Kantstraße 12", plz: "10623", ort: "Berlin" },
  { id: "prenzlauer-01", bezirk: "Prenzlauer Berg", strasse: "Schönhauser Allee 88", plz: "10439", ort: "Berlin" },
  { id: "kreuzberg-01", bezirk: "Kreuzberg", strasse: "Manteuffelstraße 34", plz: "10997", ort: "Berlin" },
  { id: "mitte-01", bezirk: "Mitte", strasse: "Invalidenstraße 101", plz: "10115", ort: "Berlin" },
  { id: "neukoelln-01", bezirk: "Neukölln", strasse: "Sonnenallee 157", plz: "12059", ort: "Berlin" },
  { id: "schoeneberg-01", bezirk: "Schöneberg", strasse: "Hauptstraße 45", plz: "10827", ort: "Berlin" },
  { id: "friedrichshain-01", bezirk: "Friedrichshain", strasse: "Simon-Dach-Straße 19", plz: "10245", ort: "Berlin" },
  { id: "spandau-01", bezirk: "Spandau", strasse: "Klosterstraße 6", plz: "13581", ort: "Berlin" },
  { id: "steglitz-01", bezirk: "Steglitz", strasse: "Schloßstraße 118", plz: "12163", ort: "Berlin" },
  { id: "wedding-01", bezirk: "Wedding", strasse: "Müllerstraße 62", plz: "13349", ort: "Berlin" },
]

export function pickAddress(index: number): AddressFixture {
  return ADDRESS_FIXTURES[index % ADDRESS_FIXTURES.length]
}
