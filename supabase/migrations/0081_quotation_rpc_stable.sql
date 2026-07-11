-- GET cacheável no PostgREST exige função não-volátil.
alter function public.get_public_quotation(text) stable;
