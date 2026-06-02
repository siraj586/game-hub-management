from django.db import migrations


def normalize_legacy_roles(apps, schema_editor):
    User = apps.get_model("api", "User")
    User.objects.filter(role__in=["MANAGER", "CASHIER"]).update(role="STAFF")


def restore_legacy_roles(apps, schema_editor):
    # Legacy MANAGER/CASHIER users cannot be reconstructed safely once merged.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_remove_sale_branch_remove_session_branch_and_more"),
    ]

    operations = [
        migrations.RunPython(normalize_legacy_roles, restore_legacy_roles),
    ]
