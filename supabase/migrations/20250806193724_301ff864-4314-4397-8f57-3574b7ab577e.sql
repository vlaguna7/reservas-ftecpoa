-- Add classroom columns for each weekday to profiles table
ALTER TABLE public.profiles 
ADD COLUMN classroom_monday TEXT,
ADD COLUMN classroom_tuesday TEXT,
ADD COLUMN classroom_wednesday TEXT,
ADD COLUMN classroom_thursday TEXT,
ADD COLUMN classroom_friday TEXT;