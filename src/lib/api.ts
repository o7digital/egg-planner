export interface SessionUser { id:string; email:string; name:string; role:'manager'|'admin'|'super_admin'; restaurants:string[] }
export const apiBase = (import.meta.env.PUBLIC_API_URL as string|undefined)?.replace(/\/$/,'');
export async function api<T>(path:string,options:RequestInit={}) {
  if(!apiBase) throw new Error('Backend API is not configured');
  const response=await fetch(`${apiBase}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}});
  if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Request failed');
  return response.status===204?undefined as T:response.json() as Promise<T>;
}
