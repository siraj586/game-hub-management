from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_dailyreport_actual_local_received_and_more'),
    ]

    operations = [
        # Remove the application-level default so Django no longer silently
        # fills payment_currency with "USD". The view must supply it explicitly.
        migrations.AlterField(
            model_name='sale',
            name='payment_currency',
            field=models.CharField(max_length=3),
        ),
    ]
