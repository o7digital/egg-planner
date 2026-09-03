import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { query } from './db.js';

export type Role = 'manager'|'admin'|'super_admin';
export interface AuthUser { id:string; email:string; name:string; role:Role; restaurants:string[] }
declare global { namespace Express { interface Request { user?:AuthUser; cookies:Record<string,string> } } }
const tokenHash = (token:string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId:string) {
  const token=randomBytes(32).toString('base64url');
  await query('INSERT INTO sessions(id_hash,user_id,expires_at) VALUES($1,$2,now()+($3||\' hours\')::interval)',[tokenHash(token),userId,String(config.SESSION_TTL_HOURS)]);
  return token;
}
export async function auth(req:Request,res:Response,next:NextFunction) {
  const token=req.cookies?.[config.SESSION_COOKIE_NAME] as string|undefined;
  if(!token) return res.status(401).json({error:'Authentication required'});
  const result=await query<{id:string;email:string;name:string;role:Role;restaurants:string[]}>('SELECT u.id,u.email,u.name,u.role,coalesce(array_agg(ur.restaurant_id::text) FILTER (WHERE ur.restaurant_id IS NOT NULL),ARRAY[]::text[]) restaurants FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_restaurants ur ON ur.user_id=u.id WHERE s.id_hash=$1 AND s.expires_at>now() AND u.active GROUP BY u.id',[tokenHash(token)]);
  if(!result.rowCount) return res.status(401).json({error:'Authentication required'});
  req.user=result.rows[0]; next();
}
export const requireRole=(...roles:Role[]) => (req:Request,res:Response,next:NextFunction) => req.user&&roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'});
export const canAccessRestaurant=(user:AuthUser,id:string|string[]) => user.role!=='manager'||user.restaurants.includes(String(id));
export { tokenHash };
