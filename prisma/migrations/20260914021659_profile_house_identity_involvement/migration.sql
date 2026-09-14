-- AlterTable
ALTER TABLE "PrivacySettings" ADD COLUMN     "showIdentity" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "gender" TEXT,
ADD COLUMN     "house" TEXT,
ADD COLUMN     "involvement" TEXT,
ADD COLUMN     "raceEthnicity" TEXT[];
