from django.db import models

# Create your models here.

class User(models.Model):
    name = models.CharField(max_length=50)
    email = models.CharField(max_length=100)

class Event(models.Model):
    description = models.CharField(max_length=200)
    earliest_date = models.DateTimeField()
    latest_date = models.DateTimeField()
    duration = models.DurationField()
    suggested_date = models.DateTimeField()
    final = models.BooleanField()

    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='creator')
    participants = models.ManyToManyField(User)
