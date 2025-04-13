export interface IpGeoLocation {
  status?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
}
export interface Event {
  u: string;
  id: string;
  e: {
    t: string;
    p: any;
  };
}
