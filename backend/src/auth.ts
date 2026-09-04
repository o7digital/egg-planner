import type { NextFunction, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { config } from './config.js';
import { query } from './db.js';

export type Role = 'manager'|'admin'|'super_admin';
export interface AuthUser { id:string; email:string; name:string; role:Role; restaurants:string[] }
declare global { namespace Express { interface Request { user?:AuthUser; cookies:Record<string,string> } } }
export async function auth(req:Request,res:Response,next:NextFunction) {
  if(config.CLERK_SECRET_KEY&&config.CLERK_PUBLISHABLE_KEY){
    const clerkAuth=getAuth(req); if(!clerkAuth.isAuthenticated||!clerkAuth.userId)return res.status(401).json({error:'Authentication required'});
    const clerkUser=await clerkClient.users.getUser(clerkAuth.userId); const email=clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
    if(!email)return res.status(403).json({error:'A verified email is required'});
    const requestedRole=clerkUser.publicMetadata.role; const role:Role=requestedRole==='manager'||requestedRole==='admin'||requestedRole==='super_admin'?requestedRole:'manager';
    const name=clerkUser.fullName||email; await query(`INSERT INTO users(email,name,password_hash,role,clerk_user_id) VALUES($1,$2,'clerk-managed',$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,clerk_user_id=EXCLUDED.clerk_user_id,updated_at=now()`,[email,name,role,clerkAuth.userId]);
    const result=await query<{id:string;email:string;name:string;role:Role;restaurants:string[]}>(`SELECT u.id,u.email,u.name,u.role,coalesce(array_agg(ur.restaurant_id::text) FILTER(WHERE ur.restaurant_id IS NOT NULL),ARRAY[]::text[]) restaurants FROM users u LEFT JOIN user_restaurants ur ON ur.user_id=u.id WHERE u.email=$1 AND u.active GROUP BY u.id`,[email]); req.user=result.rows[0]; return next();
  }
  return res.status(503).json({error:'Clerk authentication is not configured'});
}
export const requireRole=(...roles:Role[]) => (req:Request,res:Response,next:NextFunction) => req.user&&roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'});
export const canAccessRestaurant=(user:AuthUser,id:string|string[]) => user.role!=='manager'||user.restaurants.includes(String(id));
